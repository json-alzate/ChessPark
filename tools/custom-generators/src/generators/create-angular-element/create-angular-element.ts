import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  getProjects,
  ProjectConfiguration,
  logger,
} from '@nx/devkit';
import { CreateAngularElementSchema } from './schema';

interface NormalizedOptions extends CreateAngularElementSchema {
  targetPath: string;
  projectConfig: ProjectConfiguration;
}

export default async function (tree: Tree, options: CreateAngularElementSchema) {
  // Validar y obtener lista de proyectos
  const projects = getProjects(tree);
  
  // Si no se especifica projectName, necesitamos obtener la lista de proyectos válidos
  if (!options.projectName) {
    const validProjects = getValidProjects(projects, options.projectType);
    if (validProjects.length === 0) {
      throw new Error(`No se encontraron ${options.projectType === 'app' ? 'aplicaciones' : 'librerías'} en el workspace`);
    }
    // En este punto, el CLI debería mostrar la lista para seleccionar
    throw new Error('Debe especificar un proyecto válido');
  }

  // Normalizar opciones
  const normalizedOptions = normalizeOptions(tree, options, projects);
  
  // Validar que el proyecto existe
  if (!normalizedOptions.projectConfig) {
    throw new Error(`El proyecto "${options.projectName}" no existe`);
  }

  // Validar tipo de proyecto
  const isApp = normalizedOptions.projectConfig.projectType === 'application';
  const isLib = normalizedOptions.projectConfig.projectType === 'library';
  
  if (options.projectType === 'app' && !isApp) {
    throw new Error(`"${options.projectName}" no es una aplicación`);
  }
  
  if (options.projectType === 'lib' && !isLib) {
    throw new Error(`"${options.projectName}" no es una librería`);
  }

  logger.info(`Generando ${options.elementType} "${options.name}" en ${options.projectType} "${options.projectName}"`);
  logger.info(`Ruta de destino: ${normalizedOptions.targetPath}`);

  // Generar archivos según el tipo de elemento
  const nameUtils = names(normalizedOptions.name);
  const templateData = {
    ...normalizedOptions,
    ...nameUtils,
    standalone: normalizedOptions.elementType === 'component' ? normalizedOptions.standalone : false,
    skipTests: normalizedOptions.skipTests,
    // Agregar funciones de utilidad para las plantillas
    dasherize: (str: string) => nameUtils.fileName,
    classify: (str: string) => nameUtils.className,
    camelize: (str: string) => nameUtils.propertyName,
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files', normalizedOptions.elementType),
    normalizedOptions.targetPath,
    templateData
  );

  // Generar archivos de test si no se omiten
  if (!normalizedOptions.skipTests) {
    // Los archivos de test ya están incluidos en las plantillas
  }

  // Formatear archivos
  await formatFiles(tree);
  
  logger.info(`✅ ${getElementTypeLabel(options.elementType)} generado exitosamente`);
}

function getValidProjects(projects: Map<string, ProjectConfiguration>, projectType: 'app' | 'lib'): string[] {
  const validProjects: string[] = [];
  
  projects.forEach((config, name) => {
    if (projectType === 'app' && config.projectType === 'application') {
      validProjects.push(name);
    } else if (projectType === 'lib' && config.projectType === 'library') {
      validProjects.push(name);
    }
  });
  
  return validProjects;
}

function normalizeOptions(
  tree: Tree,
  options: CreateAngularElementSchema,
  projects: Map<string, ProjectConfiguration>
): NormalizedOptions {
  const projectConfig = projects.get(options.projectName);
  
  if (!projectConfig) {
    throw new Error(`Proyecto "${options.projectName}" no encontrado`);
  }

  let basePath: string;
  
  if (options.projectType === 'app') {
    basePath = joinPathFragments(projectConfig.root, 'src', 'app');
  } else {
    basePath = joinPathFragments(projectConfig.root, 'src', 'lib');
  }
  
  // Construir la ruta completa
  const relativePath = options.path ? options.path.replace(/^\/+|\/+$/g, '') : '';
  const targetPath = relativePath 
    ? joinPathFragments(basePath, relativePath)
    : basePath;

  return {
    ...options,
    targetPath,
    projectConfig,
    standalone: options.elementType === 'component' ? (options.standalone !== false) : false,
  };
}

function getElementTypeLabel(elementType: string): string {
  const labels = {
    component: 'Componente',
    service: 'Servicio',
    guard: 'Guard',
    directive: 'Directiva',
    pipe: 'Pipe'
  };
  return labels[elementType] || elementType;
}

export { CreateAngularElementSchema };
