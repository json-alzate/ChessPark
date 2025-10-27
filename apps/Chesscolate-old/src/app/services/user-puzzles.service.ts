import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';

// states
import { UserPuzzlesState } from '@redux/states/user-puzzles.state';

// actions
import { requestAddOneUserPuzzle, addOneUserPuzzle } from '@redux/actions/user-puzzles.actions';

// selectors
import { getAllUserPuzzles } from '@redux/selectors/user-puzzles.selectors';



import { UserPuzzle } from '@models/user-puzzles.model';

// services
import { ProfileService } from '@services/profile.service';
import { FirestoreService } from '@services/firestore.service';


@Injectable({
  providedIn: 'root'
})
export class UserPuzzlesService {

  private userPuzzles: UserPuzzle[] = [];

  constructor(
    private firestoreService: FirestoreService,
    private profileService: ProfileService,
    private store: Store<UserPuzzlesState>
  ) {
    this.listenUserPuzzles();
  }

  get getUserPuzzles() {
    return this.userPuzzles;
  }

  listenUserPuzzles() {
    this.store.pipe(select(getAllUserPuzzles)).subscribe((userPuzzles: UserPuzzle[]) => {
      this.userPuzzles = userPuzzles;
    });
  }



  saveUserPuzzle(userPuzzle: UserPuzzle) {
    // check if profile
    const profile = this.profileService.getProfile;

    if (!profile) {
      const action = addOneUserPuzzle({ userPuzzle });
      this.store.dispatch(action);
      return;
    }
    this.requestAddOneUserPuzzle(userPuzzle);
  }

  // actions
  requestAddOneUserPuzzle(userPuzzle: UserPuzzle) {
    const action = requestAddOneUserPuzzle({ userPuzzle });
    this.store.dispatch(action);
  }


  loadUserPuzzles(uid: string) {
    return this.firestoreService.getUserPuzzlesByUidUser(uid);
  }


  addOneUserPuzzle(userPuzzle: UserPuzzle) {
    return this.firestoreService.addOneUserPuzzle(userPuzzle);
  }


}
