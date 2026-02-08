// JobTread API Client
// JobTread uses the Pave query language at https://api.jobtread.com/pave
// with Grant-based Bearer token authentication.
//
// Query format: POST JSON body { "query": { ... } }
// - "$" holds input parameters for a field
// - Empty objects {} request scalar fields
// - Nested objects request sub-selections
// - Collections use "nodes" to return arrays
//
// Example – list jobs for an org:
// {
//   "query": {
//     "organization": {
//       "$": { "id": "<orgId>" },
//       "jobs": {
//         "$": { "size": 50 },
//         "nodes": { "id": {}, "name": {}, "status": {} }
//       }
//     }
//   }
// }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobTreadLocation {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface JobTreadContact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
}

export interface JobTreadJob {
  id: string;
  name: string;
  number?: string;
  status: string;
  description?: string;
  closedOn?: string;
  location?: JobTreadLocation;
  /** JobTread returns customer data on jobs */
  customer?: JobTreadContact;
  /** Fallback alias for backward compatibility */
  contact?: JobTreadContact;
  createdAt: string;
}

export interface JobTreadProposalLineItem {
  id: string;
  name: string;
  description?: string;
}

export interface JobTreadProposalGroup {
  id: string;
  name: string;
  lineItems: { nodes: JobTreadProposalLineItem[] };
}

export interface JobTreadProposal {
  id: string;
  name: string;
  status: string;
  groups: { nodes: JobTreadProposalGroup[] };
}

export interface JobTreadFile {
  id: string;
  name: string;
  url: string;
  tags?: string[];
}

export interface JobTreadTask {
  id: string;
  title?: string;
  description?: string;
  dueDate?: string;
}

export interface JobTreadOrganization {
  id: string;
  name: string;
}

export class JobTreadApiError extends Error {
  readonly statusCode?: number;
  readonly apiMessage?: string;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'JobTreadApiError';
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a "return shape" object for scalar fields.
 * Each field name maps to `{}` which tells the Pave API to include it.
 */
function f(...names: string[]): Record<string, Record<string, never>> {
  const obj: Record<string, Record<string, never>> = {};
  for (const n of names) obj[n] = {};
  return obj;
}

/** Fields we request for every job. */
const JOB_FIELDS = {
  ...f('id', 'name', 'number', 'status', 'description', 'closedOn', 'createdAt'),
  location: f('id', 'address', 'latitude', 'longitude'),
  // JobTread uses "customer" as the contact entity on jobs
  customer: f('id', 'name', 'email', 'phone', 'company'),
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class JobTreadClient {
  // Route through the same-origin PHP proxy to avoid CORS issues.
  // The proxy forwards requests to https://api.jobtread.com/pave server-side.
  private readonly endpoint = '/api/jobtread-proxy.php';
  private accessToken: string;
  private _orgId: string | null = null;

  constructor(accessToken: string) {
    if (!accessToken) {
      throw new JobTreadApiError('Access token is required');
    }
    this.accessToken = accessToken;
  }

  // -----------------------------------------------------------------------
  // Core query method
  // -----------------------------------------------------------------------

  /**
   * Execute a Pave query against the JobTread API.
   * The query is wrapped in { "query": { ... } }.
   */
  private async query<T = unknown>(
    paveQuery: Record<string, unknown>
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: paveQuery }),
      });
    } catch (err) {
      throw new JobTreadApiError(
        `Network error communicating with JobTread: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new JobTreadApiError(
        `JobTread API error: ${response.status} - ${errorBody}`,
        response.status
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new JobTreadApiError('Failed to parse JobTread API response');
    }

    // The API returns error strings directly for invalid queries
    if (typeof result === 'string') {
      throw new JobTreadApiError(result);
    }

    return result as T;
  }

  // -----------------------------------------------------------------------
  // Organization resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve the organization ID for the current grant.
   * This is needed because listing jobs requires querying through the org.
   * The result is cached for the lifetime of this client instance.
   */
  async getOrganizationId(): Promise<string> {
    if (this._orgId) return this._orgId;

    const data = await this.query<{
      currentGrant: {
        user: {
          memberships: {
            nodes: Array<{ organization: { id: string; name: string } }>;
          };
        };
      };
    }>({
      currentGrant: {
        user: {
          memberships: {
            nodes: {
              organization: f('id', 'name'),
            },
          },
        },
      },
    });

    const memberships = data.currentGrant?.user?.memberships?.nodes;
    if (!memberships || memberships.length === 0) {
      throw new JobTreadApiError('No organization found for this grant key');
    }

    this._orgId = memberships[0].organization.id;
    return this._orgId;
  }

  /**
   * Get the organization details.
   */
  async getOrganization(): Promise<JobTreadOrganization> {
    const orgId = await this.getOrganizationId();

    const data = await this.query<{
      organization: JobTreadOrganization;
    }>({
      organization: {
        $: { id: orgId },
        ...f('id', 'name'),
      },
    });

    return data.organization;
  }

  // -----------------------------------------------------------------------
  // Connection test
  // -----------------------------------------------------------------------

  /**
   * Test whether the current API key is valid.
   * Fetches the version and current grant to verify.
   */
  async testConnection(): Promise<{ grantId: string; orgName: string }> {
    const data = await this.query<{
      version: string;
      currentGrant: {
        id: string;
        user: {
          memberships: {
            nodes: Array<{ organization: { id: string; name: string } }>;
          };
        };
      };
    }>({
      version: {},
      currentGrant: {
        id: {},
        user: {
          memberships: {
            nodes: {
              organization: f('id', 'name'),
            },
          },
        },
      },
    });

    const memberships = data.currentGrant?.user?.memberships?.nodes;
    const orgName = memberships?.[0]?.organization?.name ?? 'Unknown';
    const orgId = memberships?.[0]?.organization?.id;

    // Cache the org ID
    if (orgId) this._orgId = orgId;

    return {
      grantId: data.currentGrant.id,
      orgName,
    };
  }

  // -----------------------------------------------------------------------
  // Jobs
  // -----------------------------------------------------------------------

  /**
   * Fetch jobs from the organization with optional where filter.
   */
  async getJobs(
    limit = 100,
    where?: Record<string, unknown>
  ): Promise<JobTreadJob[]> {
    const orgId = await this.getOrganizationId();

    const jobsParams: Record<string, unknown> = { size: limit };
    if (where) jobsParams.where = where;

    const data = await this.query<{
      organization: {
        jobs: {
          nodes: JobTreadJob[];
        };
      };
    }>({
      organization: {
        $: { id: orgId },
        jobs: {
          $: jobsParams,
          nodes: JOB_FIELDS,
        },
      },
    });

    return data.organization?.jobs?.nodes ?? [];
  }

  /**
   * Fetch ALL jobs by making separate filtered API calls and combining.
   *
   * The JobTread API caps results at 100 per request with no real pagination.
   * We work around this by splitting queries using date-range batches and
   * the `closedOn` field so every job is captured regardless of total count.
   *
   * Strategy:
   *   1. Fetch non-closed jobs in yearly batches (handles 100+ open jobs)
   *   2. Fetch closed jobs in yearly batches (handles 100+ closed jobs)
   *   3. Deduplicate by ID and return the combined set
   */
  async getAllJobs(): Promise<JobTreadJob[]> {
    const seen = new Set<string>();
    const allJobs: JobTreadJob[] = [];

    const addJobs = (jobs: JobTreadJob[]) => {
      for (const job of jobs) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          allJobs.push(job);
        }
      }
    };

    // Build yearly date boundaries from 2024 to current year + 1
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let y = 2024; y <= currentYear + 1; y++) {
      years.push(`${y}-01-01T00:00:00.000Z`);
    }

    // Fetch non-closed jobs in yearly batches
    for (let i = 0; i < years.length - 1; i++) {
      const batch = await this.getJobs(100, {
        and: [
          { '=': [{ field: 'closedOn' }, { value: null }] },
          { '>=': [{ field: 'createdAt' }, { value: years[i] }] },
          { '<': [{ field: 'createdAt' }, { value: years[i + 1] }] },
        ],
      });
      addJobs(batch);
    }

    // Also fetch any non-closed jobs created before our earliest year
    const veryOld = await this.getJobs(100, {
      and: [
        { '=': [{ field: 'closedOn' }, { value: null }] },
        { '<': [{ field: 'createdAt' }, { value: years[0] }] },
      ],
    });
    addJobs(veryOld);

    // Fetch closed jobs in yearly batches
    for (let i = 0; i < years.length - 1; i++) {
      const batch = await this.getJobs(100, {
        and: [
          { '!=': [{ field: 'closedOn' }, { value: null }] },
          { '>=': [{ field: 'createdAt' }, { value: years[i] }] },
          { '<': [{ field: 'createdAt' }, { value: years[i + 1] }] },
        ],
      });
      addJobs(batch);
    }

    // Also fetch any closed jobs created before our earliest year
    const veryOldClosed = await this.getJobs(100, {
      and: [
        { '!=': [{ field: 'closedOn' }, { value: null }] },
        { '<': [{ field: 'createdAt' }, { value: years[0] }] },
      ],
    });
    addJobs(veryOldClosed);

    return allJobs;
  }

  /**
   * Fetch a single job by ID.
   */
  async getJob(id: string): Promise<JobTreadJob> {
    const data = await this.query<{ job: JobTreadJob }>({
      job: {
        $: { id },
        ...JOB_FIELDS,
      },
    });

    return data.job;
  }

  // -----------------------------------------------------------------------
  // Files
  // -----------------------------------------------------------------------

  /**
   * Upload a file to a job by URL reference.
   */
  async uploadFile(
    jobId: string,
    fileUrl: string,
    fileName: string
  ): Promise<JobTreadFile> {
    const data = await this.query<{
      createFile: { createdFile: JobTreadFile };
    }>({
      createFile: {
        $: { jobId, url: fileUrl, name: fileName },
        createdFile: f('id', 'name', 'url'),
      },
    });

    return data.createFile.createdFile;
  }

  /**
   * Update an existing file's metadata.
   */
  async updateFile(
    fileId: string,
    updateData: { name?: string; tags?: string[]; folderId?: string }
  ): Promise<JobTreadFile> {
    const data = await this.query<{
      updateFile: { updatedFile: JobTreadFile };
    }>({
      updateFile: {
        $: { id: fileId, ...updateData },
        updatedFile: f('id', 'name', 'url'),
      },
    });

    return data.updateFile.updatedFile;
  }

  /**
   * Fetch files for a job.
   */
  async getJobFiles(jobId: string): Promise<JobTreadFile[]> {
    const data = await this.query<{
      job: {
        documents: {
          nodes: JobTreadFile[];
        };
      };
    }>({
      job: {
        $: { id: jobId },
        documents: {
          nodes: f('id', 'name', 'url'),
        },
      },
    });

    return data.job?.documents?.nodes ?? [];
  }

  // -----------------------------------------------------------------------
  // Job creation
  // -----------------------------------------------------------------------

  /**
   * Create a new job in JobTread.
   */
  async createJob(jobData: {
    name: string;
    description?: string;
    organizationId?: string;
  }): Promise<JobTreadJob> {
    const orgId = jobData.organizationId ?? await this.getOrganizationId();

    const data = await this.query<{
      createJob: { createdJob: JobTreadJob };
    }>({
      createJob: {
        $: {
          name: jobData.name,
          description: jobData.description,
          organizationId: orgId,
        },
        createdJob: JOB_FIELDS,
      },
    });

    return data.createJob.createdJob;
  }

  // -----------------------------------------------------------------------
  // Proposals
  // -----------------------------------------------------------------------

  /**
   * Fetch proposals/estimates for a specific job.
   * JobTread may call these "proposals" or "estimates" depending on version.
   * Returns proposals with their groups and line items.
   */
  async getJobProposals(jobId: string): Promise<JobTreadProposal[]> {
    // Try "estimates" first (more common in newer JobTread versions),
    // then fall back to "proposals"
    try {
      const data = await this.query<{
        job: {
          estimates?: {
            nodes: JobTreadProposal[];
          };
          proposals?: {
            nodes: JobTreadProposal[];
          };
        };
      }>({
        job: {
          $: { id: jobId },
          estimates: {
            nodes: {
              ...f('id', 'name', 'status'),
              groups: {
                nodes: {
                  ...f('id', 'name'),
                  lineItems: {
                    nodes: f('id', 'name', 'description'),
                  },
                },
              },
            },
          },
        },
      });

      const estimateNodes = data.job?.estimates?.nodes;
      if (estimateNodes && estimateNodes.length > 0) {
        return estimateNodes;
      }
    } catch (err) {
      // "estimates" field might not exist — try "proposals" instead
      console.warn('[JobTread] "estimates" query failed, trying "proposals":', err);
    }

    // Fallback: try "proposals"
    try {
      const data = await this.query<{
        job: {
          proposals: {
            nodes: JobTreadProposal[];
          };
        };
      }>({
        job: {
          $: { id: jobId },
          proposals: {
            nodes: {
              ...f('id', 'name', 'status'),
              groups: {
                nodes: {
                  ...f('id', 'name'),
                  lineItems: {
                    nodes: f('id', 'name', 'description'),
                  },
                },
              },
            },
          },
        },
      });

      return data.job?.proposals?.nodes ?? [];
    } catch (err) {
      console.error('[JobTread] Both "estimates" and "proposals" queries failed:', err);
      return [];
    }
  }
}
