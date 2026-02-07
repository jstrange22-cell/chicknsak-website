// JobTread GraphQL API Client
// JobTread uses a GraphQL API at https://api.jobtread.com/graphql with OAuth2 bearer tokens.

export interface JobTreadAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
}

export interface JobTreadCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

export interface JobTreadJob {
  id: string;
  name: string;
  number?: string;
  status: string;
  address?: JobTreadAddress;
  customer?: JobTreadCustomer;
  createdAt: string;
  updatedAt: string;
}

export interface JobTreadFile {
  id: string;
  name: string;
  url: string;
  jobId: string;
  tags?: string[];
}

export interface JobTreadTask {
  id: string;
  title?: string;
  description?: string;
  dueDate?: string;
  jobId?: string;
}

export class JobTreadApiError extends Error {
  readonly statusCode?: number;
  readonly graphqlErrors?: Array<{ message: string; path?: string[] }>;

  constructor(
    message: string,
    statusCode?: number,
    graphqlErrors?: Array<{ message: string; path?: string[] }>
  ) {
    super(message);
    this.name = 'JobTreadApiError';
    this.statusCode = statusCode;
    this.graphqlErrors = graphqlErrors;
  }
}

export class JobTreadClient {
  private readonly endpoint = 'https://api.jobtread.com/graphql';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    if (!accessToken) {
      throw new JobTreadApiError('Access token is required');
    }
  }

  /**
   * Execute a GraphQL query or mutation against the JobTread API.
   */
  private async query<T = unknown>(
    gql: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: gql, variables }),
      });
    } catch (err) {
      throw new JobTreadApiError(
        `Network error communicating with JobTread: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new JobTreadApiError(
        `JobTread API error: ${response.status} ${response.statusText} - ${errorBody}`,
        response.status
      );
    }

    let result: { data?: T; errors?: Array<{ message: string; path?: string[] }> };
    try {
      result = await response.json();
    } catch {
      throw new JobTreadApiError('Failed to parse JobTread API response as JSON');
    }

    if (result.errors?.length) {
      throw new JobTreadApiError(
        `JobTread GraphQL error: ${result.errors[0].message}`,
        undefined,
        result.errors
      );
    }

    if (!result.data) {
      throw new JobTreadApiError('JobTread API returned no data');
    }

    return result.data;
  }

  /**
   * Fetch a paginated list of jobs.
   */
  async getJobs(limit = 50): Promise<JobTreadJob[]> {
    const data = await this.query<{
      jobs: { edges: Array<{ node: JobTreadJob }> };
    }>(`
      query GetJobs($limit: Int) {
        jobs(first: $limit) {
          edges {
            node {
              id
              name
              number
              status
              address {
                street
                city
                state
                zip
                latitude
                longitude
              }
              customer {
                id
                name
                email
                phone
                company
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    `, { limit });

    return data.jobs.edges.map((e) => e.node);
  }

  /**
   * Fetch a single job by ID.
   */
  async getJob(id: string): Promise<JobTreadJob> {
    const data = await this.query<{ job: JobTreadJob }>(`
      query GetJob($id: ID!) {
        job(id: $id) {
          id
          name
          number
          status
          address {
            street
            city
            state
            zip
            latitude
            longitude
          }
          customer {
            id
            name
            email
            phone
            company
          }
          createdAt
          updatedAt
        }
      }
    `, { id });

    return data.job;
  }

  /**
   * Upload a file to a job by URL reference.
   */
  async uploadFile(
    jobId: string,
    fileUrl: string,
    fileName: string
  ): Promise<JobTreadFile> {
    const data = await this.query<{ createFile: JobTreadFile }>(`
      mutation UploadFile($input: CreateFileInput!) {
        createFile(input: $input) {
          id
          name
          url
          jobId
          tags
        }
      }
    `, {
      input: { jobId, url: fileUrl, name: fileName },
    });

    return data.createFile;
  }

  /**
   * Create a task on a job.
   */
  async createTask(
    jobId: string,
    task: { title: string; description?: string; dueDate?: string }
  ): Promise<JobTreadTask> {
    const data = await this.query<{ createTask: JobTreadTask }>(`
      mutation CreateTask($input: CreateTaskInput!) {
        createTask(input: $input) {
          id
        }
      }
    `, {
      input: { jobId, ...task },
    });

    return data.createTask;
  }

  /**
   * Fetch a single customer by ID.
   */
  async getCustomer(id: string): Promise<JobTreadCustomer | null> {
    const data = await this.query<{ customer: JobTreadCustomer | null }>(`
      query GetCustomer($id: ID!) {
        customer(id: $id) {
          id
          name
          email
          phone
          company
        }
      }
    `, { id });

    return data.customer;
  }

  /**
   * Create a new job in JobTread.
   */
  async createJob(jobData: {
    name: string;
    status?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      latitude?: number;
      longitude?: number;
    };
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerCompany?: string;
  }): Promise<JobTreadJob> {
    const data = await this.query<{ createJob: JobTreadJob }>(`
      mutation CreateJob($input: CreateJobInput!) {
        createJob(input: $input) {
          id
          name
          number
          status
          address {
            street
            city
            state
            zip
            latitude
            longitude
          }
          customer {
            id
            name
            email
            phone
            company
          }
          createdAt
          updatedAt
        }
      }
    `, {
      input: jobData,
    });

    return data.createJob;
  }

  /**
   * Update an existing file's metadata (name, tags, folder, etc.).
   */
  async updateFile(
    fileId: string,
    data: {
      name?: string;
      tags?: string[];
      folderId?: string;
    }
  ): Promise<JobTreadFile> {
    const result = await this.query<{ updateFile: JobTreadFile }>(`
      mutation UpdateFile($id: ID!, $input: UpdateFileInput!) {
        updateFile(id: $id, input: $input) {
          id
          name
          url
          jobId
          tags
        }
      }
    `, {
      id: fileId,
      input: data,
    });

    return result.updateFile;
  }

  /**
   * Fetch all files linked to a specific job.
   */
  async getJobFiles(jobId: string, limit = 100): Promise<JobTreadFile[]> {
    const data = await this.query<{
      files: { edges: Array<{ node: JobTreadFile }> };
    }>(`
      query GetJobFiles($jobId: ID!, $limit: Int) {
        files(jobId: $jobId, first: $limit) {
          edges {
            node {
              id
              name
              url
              jobId
              tags
            }
          }
        }
      }
    `, { jobId, limit });

    return data.files.edges.map((e) => e.node);
  }
}
