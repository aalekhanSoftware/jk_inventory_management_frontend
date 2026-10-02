import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { PageAccessItem, RoleAdminService, RoleItem } from '../../services/role-admin.service';

interface AccessGroup {
  menuGroup: string;
  items: PageAccessItem[];
}

/** ROLE_PAGE_ACCESS: Admin configures Manufacturer/Dispatch page access. */
@Component({
  selector: 'app-role-config',
  standalone: true,
  imports: [CommonModule, FormsModule, LoaderComponent],
  templateUrl: './role-config.component.html',
  styleUrls: ['./role-config.component.scss']
})
export class RoleConfigComponent implements OnInit {
  isLoading = false;
  isSaving = false;
  roles: RoleItem[] = [];
  selectedRoleId: number | null = null;
  catalog: PageAccessItem[] = [];
  groups: AccessGroup[] = [];
  selectedIds = new Set<number>();

  constructor(
    private roleAdminService: RoleAdminService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.loadInitial();
  }

  loadInitial(): void {
    this.isLoading = true;
    this.roleAdminService.getRoles().subscribe({
      next: (roleRes) => {
        this.roles = (roleRes.data || []).filter(r => (r.roleCode || '').toUpperCase() !== 'ADMIN');
        this.roleAdminService.getCatalog().subscribe({
          next: (catalogRes) => {
            this.catalog = catalogRes.data || [];
            this.buildGroups();
            if (this.roles.length) {
              this.selectedRoleId = this.roles[0].id;
              this.loadRoleAccess();
            } else {
              this.isLoading = false;
            }
          },
          error: (err) => {
            this.isLoading = false;
            this.snackbar.error(err?.error?.message || 'Failed to load page access catalog');
          }
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.snackbar.error(err?.error?.message || 'Failed to load roles');
      }
    });
  }

  onRoleChange(): void {
    this.loadRoleAccess();
  }

  loadRoleAccess(): void {
    if (!this.selectedRoleId) {
      return;
    }
    this.isLoading = true;
    this.roleAdminService.getRoleAccess(this.selectedRoleId).subscribe({
      next: (res) => {
        this.selectedIds = new Set(res.data || []);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.snackbar.error(err?.error?.message || 'Failed to load role access');
      }
    });
  }

  isChecked(id: number): boolean {
    return this.selectedIds.has(id);
  }

  toggle(id: number, checked: boolean): void {
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }

  onCheckboxChange(id: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.toggle(id, !!input?.checked);
  }

  save(): void {
    if (!this.selectedRoleId || this.isSaving) {
      return;
    }
    this.isSaving = true;
    const ids = Array.from(this.selectedIds);
    this.roleAdminService.updateRoleAccess(this.selectedRoleId, ids).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.selectedIds = new Set(res.data || ids);
        this.snackbar.success(res.message || 'Role access saved');
      },
      error: (err) => {
        this.isSaving = false;
        this.snackbar.error(err?.error?.message || 'Failed to save role access');
      }
    });
  }

  private buildGroups(): void {
    const map = new Map<string, PageAccessItem[]>();
    for (const item of this.catalog) {
      const key = item.menuGroup || 'Other';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }
    this.groups = Array.from(map.entries()).map(([menuGroup, items]) => ({
      menuGroup,
      items: items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    }));
  }
}
