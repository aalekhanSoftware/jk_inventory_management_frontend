import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PageAccessService } from '../../../services/page-access.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private pageAccessService: PageAccessService,
    private router: Router,
    private snackbar: SnackbarService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.authService.login(this.loginForm.value).subscribe({
        next: () => {
          this.snackbar.success('Login successful');
          this.pageAccessService.refresh().subscribe({
            next: () => {
              const route = this.pageAccessService.getFirstAllowedRoute();
              this.router.navigate([route === '/login' ? '/category' : route]);
              this.isLoading = false;
            },
            error: () => {
              this.router.navigate(['/category']);
              this.isLoading = false;
            }
          });
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Login failed');
          this.isLoading = false;
        }
      });
    } else {
      this.snackbar.warning('Please fill in all required fields correctly');
    }
  }
}
