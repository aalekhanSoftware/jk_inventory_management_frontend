import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { RoleAdminService, RoleItem, UserRoleItem } from '../../services/role-admin.service';

/** ROLE_PAGE_ACCESS: Admin assigns Admin/Manufacturer/Dispatch to users. */
@Component({
  selector: 'app-user-role',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LoaderComponent, PaginationComponent],
  templateUrl: './user-role.component.html',
  styleUrls: ['./user-role.component.scss']
})
export class UserRoleComponent implements OnInit {
  users: UserRoleItem[] = [];
  roles: RoleItem[] = [];
  searchForm!: FormGroup;
  isLoading = false;
  savingIds = new Set<number>();
  draftRoleIds: Record<number, number | null> = {};

  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  totalPages = 0;
  totalElements = 0;

  constructor(
    private roleAdminService: RoleAdminService,
    private fb: FormBuilder,
    private snackbar: SnackbarService
  ) {
    this.searchForm = this.fb.group({
      search: ['']
    });
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadUsers();
  }

  loadRoles(): void {
    this.roleAdminService.getRoles().subscribe({
      next: (res) => {
        this.roles = res.data || [];
      },
      error: (err) => {
        this.snackbar.error(err?.error?.message || 'Failed to load roles');
      }
    });
  }

  loadUsers(): void {
    this.isLoading = true;
    this.roleAdminService.searchUsers({
      search: this.searchForm.value.search || '',
      page: this.currentPage,
      size: this.pageSize
    }).subscribe({
      next: (res) => {
        const data = res.data || {};
        this.users = data.content || [];
        this.totalElements = data.totalElements || 0;
        this.totalPages = data.totalPages || 0;
        this.currentPage = data.page ?? this.currentPage;
        this.draftRoleIds = {};
        for (const user of this.users) {
          this.draftRoleIds[user.id] = user.roleId ?? null;
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.snackbar.error(err?.error?.message || 'Failed to load users');
      }
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadUsers();
  }

  resetForm(): void {
    this.searchForm.reset({ search: '' });
    this.currentPage = 0;
    this.loadUsers();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadUsers();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.loadUsers();
  }

  saveRole(user: UserRoleItem): void {
    const roleId = this.draftRoleIds[user.id];
    if (!roleId || this.savingIds.has(user.id)) {
      this.snackbar.error('Please select a role');
      return;
    }
    this.savingIds.add(user.id);
    this.roleAdminService.updateUserRole(user.id, roleId).subscribe({
      next: (res) => {
        this.savingIds.delete(user.id);
        const updated = res.data;
        if (updated) {
          user.roleId = updated.roleId;
          user.roleName = updated.roleName;
          user.roleCode = updated.roleCode;
          this.draftRoleIds[user.id] = updated.roleId ?? null;
        }
        this.snackbar.success(res.message || 'User role updated');
      },
      error: (err) => {
        this.savingIds.delete(user.id);
        this.snackbar.error(err?.error?.message || 'Failed to update user role');
      }
    });
  }

  isSaving(userId: number): boolean {
    return this.savingIds.has(userId);
  }

  displayName(user: UserRoleItem): string {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return name || '-';
  }
}
