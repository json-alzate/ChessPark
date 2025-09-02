import {
  Tree,
  formatFiles,
  generateFiles,
  names,
  joinPathFragments,
} from '@nx/devkit';
import { CreateAppGeneratorSchema } from './schema';
import { join } from 'path';

export default async function (tree: Tree, options: CreateAppGeneratorSchema) {
  const appNames = names(options.name);
  
  // Configuración por defecto - todas las opciones están habilitadas
  const hasCapacitor = true;
  const hasIonic = true;
  const hasTailwind = true;
  const hasDaisyUI = true;
  const hasSwiper = true;
  const hasServiceWorker = true;
  const hasTests = true;
  const hasLint = true;

  // Generar archivos para la aplicación respetando la estructura de directorios
  const baseDir = 'apps';
  
  // Generar la aplicación principal
  generateFiles(
    tree,
    join(__dirname, 'files', 'app'),
    joinPathFragments(baseDir, appNames.fileName),
    {
      name: appNames.fileName,
      classifyName: appNames.className,
      description: options.description || '',
      hasCapacitor,
      hasIonic,
      hasTailwind,
      hasDaisyUI,
      hasSwiper,
      hasServiceWorker,
      hasTests,
      hasLint,
      tmpl: '',
    }
  );

  // Generar archivos de configuración
  generateFiles(
    tree,
    join(__dirname, 'files', 'config'),
    joinPathFragments(baseDir, appNames.fileName),
    {
      name: appNames.fileName,
      classifyName: appNames.className,
      description: options.description || '',
      hasCapacitor,
      hasIonic,
      hasTailwind,
      hasDaisyUI,
      hasSwiper,
      hasServiceWorker,
      hasTests,
      hasLint,
      tmpl: '',
    }
  );

  // Generar archivos de estilos
  generateFiles(
    tree,
    join(__dirname, 'files', 'styles'),
    joinPathFragments(baseDir, appNames.fileName, 'src'),
    {
      name: appNames.fileName,
      classifyName: appNames.className,
      description: options.description || '',
      hasCapacitor,
      hasIonic,
      hasTailwind,
      hasDaisyUI,
      hasSwiper,
      hasServiceWorker,
      hasTests,
      hasLint,
      tmpl: '',
    }
  );

  // Generar archivos de la aplicación
  generateFiles(
    tree,
    join(__dirname, 'files', 'src'),
    joinPathFragments(baseDir, appNames.fileName, 'src'),
    {
      name: appNames.fileName,
      classifyName: appNames.className,
      description: options.description || '',
      hasCapacitor,
      hasIonic,
      hasTailwind,
      hasDaisyUI,
      hasSwiper,
      hasServiceWorker,
      hasTests,
      hasLint,
      tmpl: '',
    }
  );

  // Generar archivos de assets
  generateFiles(
    tree,
    join(__dirname, 'files', 'assets'),
    joinPathFragments(baseDir, appNames.fileName, 'src', 'assets'),
    {
      name: appNames.fileName,
      classifyName: appNames.className,
      description: options.description || '',
      hasCapacitor,
      hasIonic,
      hasTailwind,
      hasDaisyUI,
      hasSwiper,
      hasServiceWorker,
      hasTests,
      hasLint,
      tmpl: '',
    }
  );

  // Generar archivos de pruebas si se solicitan
  if (hasTests) {
    generateFiles(
      tree,
      join(__dirname, 'files', 'tests'),
      joinPathFragments(baseDir, appNames.fileName),
      {
        name: appNames.fileName,
        classifyName: appNames.className,
        description: options.description || '',

        hasCapacitor,
        hasIonic,
        hasTailwind,
        hasDaisyUI,

        hasSwiper,
        hasServiceWorker,
        hasTests,
        hasLint,
        tmpl: '',
      }
    );
  }

  // Generar archivos de configuración específicos
  if (hasCapacitor) {
    generateFiles(
      tree,
      join(__dirname, 'files', 'capacitor'),
      joinPathFragments(baseDir, appNames.fileName),
      {
        name: appNames.fileName,
        classifyName: appNames.className,
        description: options.description || '',

        hasCapacitor,
        hasIonic,
        hasTailwind,
        hasDaisyUI,

        hasSwiper,
        hasServiceWorker,
        hasTests,
        hasLint,
        tmpl: '',
      }
    );
  }

  if (hasIonic) {
    generateFiles(
      tree,
      join(__dirname, 'files', 'ionic'),
      joinPathFragments(baseDir, appNames.fileName),
      {
        name: appNames.fileName,
        classifyName: appNames.className,
        description: options.description || '',

        hasCapacitor,
        hasIonic,
        hasTailwind,
        hasDaisyUI,

        hasSwiper,
        hasServiceWorker,
        hasTests,
        hasLint,
        tmpl: '',
      }
    );
  }

  if (hasTailwind || hasDaisyUI) {
    generateFiles(
      tree,
      join(__dirname, 'files', 'tailwind'),
      joinPathFragments(baseDir, appNames.fileName),
      {
        name: appNames.fileName,
        classifyName: appNames.className,
        description: options.description || '',

        hasCapacitor,
        hasIonic,
        hasTailwind,
        hasDaisyUI,

        hasSwiper,
        hasServiceWorker,
        hasTests,
        hasLint,
        tmpl: '',
      }
    );
  }

  // Actualizar el archivo de configuración del workspace si es necesario
  updateWorkspaceConfiguration(tree, appNames);

  console.log(`✅ Aplicación '${appNames.fileName}' creada exitosamente`);
  console.log(`📁 Ubicación: apps/${appNames.fileName}`);
  console.log(`🚀 Para ejecutar: nx serve ${appNames.fileName}`);
  console.log(`🏗️ Para construir: nx build ${appNames.fileName}`);

  await formatFiles(tree);
}

function updateWorkspaceConfiguration(tree: Tree, appNames: any) {
  // Esta función puede ser expandida para actualizar nx.json o workspace.json
  // Por ahora, solo mostramos un mensaje informativo
  console.log(`📝 Nota: La aplicación se ha creado como un proyecto independiente`);
  console.log(`📝 Puedes ejecutar 'nx graph' para ver la nueva estructura del workspace`);
}
