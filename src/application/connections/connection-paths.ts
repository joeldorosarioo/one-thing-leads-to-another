import { normalizePath } from '../../shared/path-utils';

export interface ConnectionPaths {
  data_path: string;
  template_path: string;
  output_path: string;
}

export function validateConnection<T extends ConnectionPaths>(job: T, configDir?: string): T {
  for (const key of ['data_path', 'template_path', 'output_path'] as const)
    job[key] = normalizePath(job[key], configDir);

  if (!job.data_path.toLowerCase().endsWith('.json')) throw new Error('Data source must be a .json file.');

  if (!job.template_path.toLowerCase().endsWith('.md') || !job.output_path.toLowerCase().endsWith('.md')) {
    throw new Error('Template and output must be .md files.');
  }

  if (new Set([job.data_path, job.template_path, job.output_path]).size !== 3) {
    throw new Error('Data, template and output paths must be different.');
  }

  return job;
}
