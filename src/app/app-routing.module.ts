import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/auth/login/login.component';
import { CategoryComponent } from './components/category/category.component';
import { ProductComponent } from './components/product/product.component';
import { AuthGuard } from './guards/auth.guard';
import { ClientPasswordGuard } from './guards/client-password.guard';
import { PageAccessGuard } from './guards/page-access.guard';
import { PurchaseComponent } from './components/purchase/purchase.component';
import { AddPurchaseComponent } from './components/add-purchase/add-purchase.component';
import { SaleComponent } from './components/sale/sale.component';
import { ProfitComponent } from './components/profit/profit.component';
import { CustomerComponent } from './components/customer/customer.component';
import { AddCombinedPurchaseSaleComponent } from './components/add-combined-purchase-sale/add-combined-purchase-sale.component';
import { PowderCoatingProcessComponent } from './components/powder-coating/powder-coating-process/powder-coating-process.component';
import { AddPowderCoatingProcessComponent } from './components/powder-coating/add-powder-coating-process/add-powder-coating-process.component';
import { TransportComponent } from './components/Transports/transport/transport.component';
import { TransportListComponent } from './components/Transports/transport-list/transport-list.component';
import { PlanDispatchListComponent } from './components/plan-dispatch/plan-dispatch-list/plan-dispatch-list.component';
import { PlanDispatchFormComponent } from './components/plan-dispatch/plan-dispatch-form/plan-dispatch-form.component';
import { PlanCoatingListComponent } from './components/plan-coating/plan-coating-list/plan-coating-list.component';
import { PlanCoatingFormComponent } from './components/plan-coating/plan-coating-form/plan-coating-form.component';
import { EmployeeListComponent } from './components/employee/employee-list/employee-list.component';
import { EmployeeFormComponent } from './components/employee/employee-form/employee-form.component';
import { MachineryListComponent } from './components/machinery/machinery-list/machinery-list.component';
import { MachineryFormComponent } from './components/machinery/machinery-form/machinery-form.component';
import { EmployeeOrderListComponent } from './components/employee-order/employee-order-list/employee-order-list.component';
import { EmployeeOrderFormComponent } from './components/employee-order/employee-order-form/employee-order-form.component';
import { PlanningListComponent } from './components/planning/planning-list/planning-list.component';
import { PlanningFormComponent } from './components/planning/planning-form/planning-form.component';
import { PlanningDetailComponent } from './components/planning/planning-detail/planning-detail.component';
import { ProductionEntryComponent } from './components/production/production-entry/production-entry.component';
import { ProductionDashboardComponent } from './components/production/production-dashboard/production-dashboard.component';
import { ProcessDateReportComponent } from './components/production/process-date-report/process-date-report.component';
import { StockMovementListComponent } from './components/production/stock-movement-list/stock-movement-list.component';
import { DailyProfitComponent } from './components/all-profits/daily-profit/daily-profit.component';
import { AddQuotationComponent } from './components/all-quotation/add-quotation/add-quotation.component';
import { QuotationComponent } from './components/all-quotation/quotation/quotation.component';
import { RoleConfigComponent } from './components/role-config/role-config.component';
import { UserRoleComponent } from './components/user-role/user-role.component';

const accessGuards = [AuthGuard, PageAccessGuard];

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'category',
    component: CategoryComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_CATEGORY' }
  },
  {
    path: 'product',
    component: ProductComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_PRODUCT' }
  },
  {
    path: 'purchase',
    component: PurchaseComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_PURCHASE' }
  },
  {
    path: 'purchase/create',
    component: AddPurchaseComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_PURCHASE' }
  },
  {
    path: 'sale',
    component: SaleComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_SALE' }
  },
  {
    path: 'profit',
    component: ProfitComponent,
    canActivate: [...accessGuards, ClientPasswordGuard],
    data: { access: 'SELECT_PRODUCT_WISE_PROFIT' }
  },
  {
    path: 'customer',
    component: CustomerComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_PARTY_PAYMENT' }
  },
  {
    path: 'combined-purchase-sale',
    component: AddCombinedPurchaseSaleComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'powder-coating-process',
    component: PowderCoatingProcessComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_COATING' }
  },
  {
    path: 'powder-coating-process/create',
    component: AddPowderCoatingProcessComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_COATING' }
  },
  {
    path: 'powder-coating-process/edit/:id',
    component: AddPowderCoatingProcessComponent,
    title: 'Edit Powder Coating Process',
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_COATING' }
  },
  {
    path: 'transport/create',
    component: TransportComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_TRANSPORT' }
  },
  {
    path: 'transport',
    component: TransportListComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_TRANSPORT' }
  },
  {
    path: 'quotation',
    component: QuotationComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_QUOTATION' }
  },
  {
    path: 'quotation/create',
    component: AddQuotationComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_QUOTATION' }
  },
  {
    path: 'transport/edit/:id',
    component: TransportComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_TRANSPORT' }
  },
  {
    path: 'plan-dispatch',
    component: PlanDispatchListComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_PLAN_DISPATCH' }
  },
  {
    path: 'plan-dispatch/create',
    component: PlanDispatchFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_PLAN_DISPATCH' }
  },
  {
    path: 'plan-dispatch/edit/:id',
    component: PlanDispatchFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_PLAN_DISPATCH' }
  },
  {
    path: 'plan-coating',
    component: PlanCoatingListComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_PLAN_COATING' }
  },
  {
    path: 'plan-coating/create',
    component: PlanCoatingFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_PLAN_COATING' }
  },
  {
    path: 'plan-coating/edit/:id',
    component: PlanCoatingFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_PLAN_COATING' }
  },
  {
    path: 'employee',
    component: EmployeeListComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_EMPLOYEE' }
  },
  {
    path: 'employee/create',
    component: EmployeeFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_EMPLOYEE' }
  },
  {
    path: 'employee/edit/:id',
    component: EmployeeFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_EMPLOYEE' }
  },
  {
    path: 'machinery',
    component: MachineryListComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_MACHINERY' }
  },
  {
    path: 'machinery/create',
    component: MachineryFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_MACHINERY' }
  },
  {
    path: 'machinery/edit/:id',
    component: MachineryFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_MACHINERY' }
  },
  {
    path: 'employee-order',
    component: EmployeeOrderListComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_EMPLOYEE_ORDER' }
  },
  {
    path: 'employee-order/create',
    component: EmployeeOrderFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_EMPLOYEE_ORDER' }
  },
  {
    path: 'employee-order/edit/:id',
    component: EmployeeOrderFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_EMPLOYEE_ORDER' }
  },
  {
    path: 'daily-profit',
    component: DailyProfitComponent,
    canActivate: [...accessGuards, ClientPasswordGuard],
    data: { access: 'SELECT_DAILY_PROFIT' }
  },
  {
    path: 'planning',
    component: PlanningListComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_PLAN' }
  },
  {
    path: 'planning/create',
    component: PlanningFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_PLAN' }
  },
  {
    path: 'planning/edit/:id',
    component: PlanningFormComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_PLAN' }
  },
  {
    path: 'planning/:id',
    component: PlanningDetailComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_PLAN' }
  },
  {
    path: 'production/entry',
    component: ProductionEntryComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_PRODUCTION' }
  },
  {
    path: 'production/edit/:id',
    component: ProductionEntryComponent,
    canActivate: accessGuards,
    data: { access: 'ADD_EDIT_PRODUCTION' }
  },
  {
    path: 'dashboard',
    component: ProductionDashboardComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_DASHBOARD' }
  },
  {
    path: 'stock-movements',
    component: StockMovementListComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_STOCK_MOVES' }
  },
  {
    path: 'production/report',
    component: ProcessDateReportComponent,
    canActivate: accessGuards,
    data: { access: 'SELECT_DATE_REPORT' }
  },
  {
    path: 'role-config',
    component: RoleConfigComponent,
    canActivate: accessGuards,
    data: { access: '__ADMIN__' }
  },
  {
    path: 'user-role',
    component: UserRoleComponent,
    canActivate: accessGuards,
    data: { access: '__ADMIN__' }
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
