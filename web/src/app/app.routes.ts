import { Routes } from '@angular/router';
import { CompanyList } from './company-list/company-list';
import { companiesResolver } from './company.resolver';

export const routes: Routes = [
  {
    path: '',
    component: CompanyList,
    resolve: { companies: companiesResolver },
  },
];
