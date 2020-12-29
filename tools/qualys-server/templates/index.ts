import { promises as fs } from 'fs';
import Mustache from 'mustache';
import path from 'path';

export async function initializeEngine() {
  const templates = await parseTemplates();
  const render = (filepath, context, callback) => {
    const templateName = path.basename(filepath);
    return callback(
      null,
      Mustache.render(templates[templateName], context, templates),
    );
  };
  return render;
}

async function parseTemplates(): Promise<Record<string, string>> {
  const templatePaths: Record<string, string> = {
    'activity-log.mustache': 'activity-log.mustache',
    'portal-version.mustache': 'portal-version.mustache',
    'webapp-list.mustache': 'webapp-list.mustache',
    'host-id-list.mustache': 'host-id-list.mustache',
    'host-details-list.mustache': 'host-details-list.mustache',
    'host-detection-list.mustache': 'host-detection-list.mustache',
    'vuln-list.mustache': 'vuln-list.mustache',

    hostDetails: 'partials/host-details.mustache',
    hostDetections: 'partials/host-detections.mustache',
    hostDetection: 'partials/host-detection.mustache',
    vuln: 'partials/vuln.mustache',
  };

  const templates: Record<string, string> = {};
  const loaders: Promise<void>[] = [];

  async function parseTemplateFile(
    templateName: string,
    templateRelativePath: string,
  ) {
    const data = await fs.readFile(
      path.join(__dirname, templateRelativePath),
      'utf-8',
    );

    console.log({ templateRelativePath }, 'Loaded template');
    templates[templateName] = data;
    Mustache.parse(data);
  }

  for (const [templateName, templatePath] of Object.entries(templatePaths)) {
    loaders.push(parseTemplateFile(templateName, templatePath));
  }

  await Promise.all(loaders);
  return templates;
}
