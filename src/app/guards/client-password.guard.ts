import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { ModalService } from '../services/modal.service';

@Injectable({
    providedIn: 'root'
})
export class ClientPasswordGuard implements CanActivate {
    constructor(
        private modalService: ModalService,
        private router: Router
    ) { }

    canActivate(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ): Observable<boolean> | Promise<boolean> | boolean {
        const confirmation = new Subject<boolean>();

        this.modalService.open('password-validation', { confirmation });

        return confirmation.asObservable();
    }
}
