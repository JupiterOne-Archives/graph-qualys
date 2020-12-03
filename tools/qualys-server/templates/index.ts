import fs from 'fs';
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
  const templatePaths = {
    'activity-log.mustache': 'activity-log.mustache',
    'host-id-list.mustache': 'host-id-list.mustache',
    'host-details-list.mustache': 'host-details-list.mustache',
    'host-detection-list.mustache': 'host-detection-list.mustache',
    'vuln-list.mustache': 'vuln-list.mustache',

    hostDetails: 'partials/host-details.mustache',
    hostDetections: 'partials/host-detections.mustache',
    vuln: 'partials/vuln.mustache',
  };

  const templates: Record<string, string> = {};

  const loaders: Promise<void>[] = [];
  for (const [templateName, templatePath] of Object.entries(templatePaths)) {
    loaders.push(
      new Promise((resolve, reject) => {
        fs.readFile(
          path.join(__dirname, templatePath),
          'utf-8',
          (err, data) => {
            if (err) reject(err);
            else {
              console.log(`Loaded template '${templatePath}'`);
              templates[templateName] = data;
              Mustache.parse(data);
              resolve();
            }
          },
        );
      }),
    );
  }

  await Promise.all(loaders);

  return templates;
}
