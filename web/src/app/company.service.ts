import { Injectable } from '@angular/core';
import { Company, CompanyInput } from './company.model';

/**
 * Server-only data access for the company API.
 *
 * This service runs exclusively inside the SSR process. It talks directly to
 * the backend API and injects the secret API key from the server environment.
 * It is never bundled into browser code paths (no HttpClient, no relative URLs),
 * so the API is not exposed to the client at all.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private get baseUrl(): string {
    return process.env['API_BASE_URL'] || 'http://127.0.0.1:3000';
  }

  private get apiKey(): string {
    return process.env['API_KEY'] || 'DUMMY123';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };
  }

  async getAll(): Promise<Company[]> {
    const res = await fetch(`${this.baseUrl}/companies`, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`Failed to load companies: ${res.status}`);
    }
    return res.json();
  }

  async create(company: CompanyInput): Promise<Company> {
    const res = await fetch(`${this.baseUrl}/companies`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(company),
    });
    if (!res.ok) {
      throw new Error(`Failed to create company: ${res.status}`);
    }
    return res.json();
  }

  async update(id: number, company: CompanyInput): Promise<Company> {
    const res = await fetch(`${this.baseUrl}/companies/${id}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(company),
    });
    if (!res.ok) {
      throw new Error(`Failed to update company: ${res.status}`);
    }
    return res.json();
  }

  async remove(id: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/companies/${id}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`Failed to delete company: ${res.status}`);
    }
  }
}
