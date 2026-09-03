import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Company } from '../company.model';

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-list.html',
  styleUrl: './company-list.css',
})
export class CompanyList {
  private readonly route = inject(ActivatedRoute);

  // Data is resolved server-side (already filtered by the "q" query parameter)
  // and hydrated into the browser. Non-matching rows are never transferred.
  protected readonly companies = signal<Company[]>(
    (this.route.snapshot.data['companies'] as Company[]) ?? [],
  );

  // The active search term, used to pre-fill the search field.
  protected readonly query = signal<string>(
    this.route.snapshot.queryParamMap.get('q') ?? '',
  );

  protected readonly editing = signal<Company | null>(null);

  edit(company: Company): void {
    this.editing.set(company);
  }

  cancelEdit(): void {
    this.editing.set(null);
  }
}
