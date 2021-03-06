import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { firestore } from 'firebase';
import { Observable, of } from 'rxjs';
import { map, shareReplay, switchMap, take } from 'rxjs/operators';
import { Member } from '../interfaces/member';
import { Room } from '../interfaces/room';
import { UserData } from '../interfaces/user';
import { Video } from '../interfaces/video';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  uid: string;
  userName: string;
  apiKey = 'AIzaSyAXIsSqQseq-O5cFLi-m9522BgokfvUYTU';

  user$: Observable<UserData> = this.afAuth.authState.pipe(
    switchMap((afUser) => {
      if (afUser) {
        this.uid = afUser && afUser.uid;
        return this.userService.getUserData(afUser.uid);
      } else {
        return of(null);
      }
    }),
    shareReplay(1)
  );

  constructor(
    private db: AngularFirestore,
    private http: HttpClient,
    private afAuth: AngularFireAuth,
    private userService: UserService
  ) {
    this.user$.subscribe((user) => {
      this.uid = user?.uid;
      this.userName = user?.userName;
    });
  }

  createRoom(
    id: string,
    title: string,
    description: string,
    thumbnailURL: string
  ): Promise<void> {
    const value: Omit<Room, 'allVideosCount'> = {
      id,
      title,
      description,
      thumbnailURL,
      initialAction: false,
      isCreating: false,
    };
    return this.db.doc(`rooms/${id}`).set(value);
  }

  updateRoomMemberIsNotActive(channelId: string): Promise<void> {
    const value: Omit<
      Member,
      'avatarId' | 'lastStatusChecked' | 'lastPosted' | 'name'
    > = {
      uid: this.uid,
      isActive: false,
    };

    return this.db
      .doc<Member>(`rooms/${channelId}/members/${this.uid}`)
      .update(value);
  }

  updateRoomMemberIsActive(channelId: string): Promise<void> {
    const value: Omit<
      Member,
      'avatarId' | 'lastStatusChecked' | 'lastPosted' | 'name'
    > = {
      uid: this.uid,
      isActive: true,
    };

    return this.db
      .doc<Member>(`rooms/${channelId}/members/${this.uid}`)
      .update(value);
  }

  addRoomMembers(channelId: string, uid: string, avatarId: number) {
    const value: Member = {
      uid,
      avatarId,
      isActive: true,
      lastStatusChecked: firestore.Timestamp.now(),
      lastPosted: firestore.Timestamp.now(),
      name: this.userName,
    };
    return this.db.doc(`rooms/${channelId}/members/${uid}`).set(value);
  }

  getMembers(channelId: string): Observable<Member[]> {
    return this.db
      .doc(`rooms/${channelId}`)
      .collection<Member>('members')
      .valueChanges();
  }

  getMember(channelId: string, uid: string): Observable<Member> {
    return this.db
      .doc<Member>(`rooms/${channelId}/members/${uid}`)
      .valueChanges();
  }

  getRooms(): Observable<Room[]> {
    return this.db.collection<Room>('rooms').valueChanges();
  }

  getRoom(channelId: string): Observable<Room> {
    return this.db.doc<Room>(`rooms/${channelId}`).valueChanges();
  }

  getChannelVideos(channelId: string) {
    return this.http
      .get('https://www.googleapis.com/youtube/v3/search', {
        params: new HttpParams({
          fromObject: {
            part: 'snippet',
            key: this.apiKey,
            maxResults: '10',
            type: 'video',
            order: 'viewCount',
            channelId,
          },
        }),
      })
      .pipe(take(1))
      .toPromise();
  }

  getVideoItem(id: string): Promise<object> {
    return this.http
      .get('https://www.googleapis.com/youtube/v3/videos', {
        params: new HttpParams({
          fromObject: {
            part: 'contentDetails',
            key: this.apiKey,
            id,
          },
        }),
      })
      .pipe(take(1))
      .toPromise();
  }

  getRandomVideoId(channelId: string, randomNumber: number): Observable<Video> {
    return this.db
      .collection<Video>(`rooms/${channelId}/videos`, (ref) =>
        ref.where('random', '>=', randomNumber).limit(1)
      )
      .valueChanges()
      .pipe(
        map((videos) => {
          if (videos.length) {
            return videos[0];
          } else {
            return null;
          }
        })
      );
  }

  collectionVideos(channelId: string) {
    this.db.collection(`rooms/${channelId}/videos`).valueChanges();
  }

  setPlayVideo(channelId: string, videoId: string): Promise<void> {
    return this.db.doc(`rooms/${channelId}/playVideo/video`).set({ videoId });
  }

  getPlayVideo(channelId: string): Observable<Video> {
    return this.db
      .doc<Video>(`rooms/${channelId}/playVideo/video`)
      .valueChanges();
  }
}
