import {
  Tree,
  formatFiles,
  generateFiles,
  names,
  joinPathFragments,
} from '@nx/devkit';
import { CreateNgrxStateGeneratorSchema } from './schema';
import { join } from 'path';

export default async function (tree: Tree, options: CreateNgrxStateGeneratorSchema) {
  const entityNames = names(options.name);
  const entityType = options.entityType;
  const hasEffects = options.hasEffects ?? true;
  const hasFacade = options.hasFacade ?? true;
  const hasTests = options.hasTests ?? true;
  const createModel = options.createModel ?? false;
  const registerInApp = options.registerInApp ?? true;

  // Validar que el nombre de la entidad sea válido para TypeScript
  if (options.name.includes('-')) {
    throw new Error(
      `❌ El nombre de la entidad no puede contener guiones (-). ` +
      `Por favor, usa camelCase o PascalCase. Ejemplo: 'userProfile' en lugar de 'user-profile'`
    );
  }

  // Crear nombre válido para propiedades de TypeScript (camelCase)
  // Asegurarse de que el nombre del archivo sea válido
  const fileName = options.name.replace(/[-_]/g, '');
  const propertyName = fileName;
  const className = entityNames.className;

  // Generar archivos para la entidad respetando la nueva estructura por entidades
  const baseDir = 'libs/state/src/lib';
  const entityDir = joinPathFragments(baseDir, fileName);
  
  // Generar estado
  generateFiles(
    tree,
    join(__dirname, 'files', 'states'),
    entityDir,
    {
      name: fileName,
      classifyName: className,
      propertyName: propertyName,
      description: options.description || '',
      entityType,
      hasEffects,
      hasFacade,
      hasTests,
      createModel,
      tmpl: '',
    }
  );

  // Generar acciones
  generateFiles(
    tree,
    join(__dirname, 'files', 'actions'),
    entityDir,
    {
      name: fileName,
      classifyName: className,
      propertyName: propertyName,
      description: options.description || '',
      entityType,
      hasEffects,
      hasFacade,
      hasTests,
      createModel,
      tmpl: '',
    }
  );

  // Generar reducer
  generateFiles(
    tree,
    join(__dirname, 'files', 'reducers'),
    entityDir,
    {
      name: fileName,
      classifyName: className,
      propertyName: propertyName,
      description: options.description || '',
      entityType,
      hasEffects,
      hasFacade,
      hasTests,
      createModel,
      tmpl: '',
    }
  );

  // Generar selectores
  generateFiles(
    tree,
    join(__dirname, 'files', 'selectors'),
    entityDir,
    {
      name: fileName,
      classifyName: className,
      propertyName: propertyName,
      description: options.description || '',
      entityType,
      hasEffects,
      hasFacade,
      hasTests,
      createModel,
      tmpl: '',
    }
  );

  // Generar efectos si se solicitan
  if (hasEffects) {
    generateFiles(
      tree,
      join(__dirname, 'files', 'effects'),
      entityDir,
      {
        name: fileName,
        classifyName: className,
        propertyName: propertyName,
        description: options.description || '',
        entityType,
        hasEffects,
        hasFacade,
        hasTests,
        createModel,
        tmpl: '',
      }
    );
  }

  // Generar facade si se solicita
  if (hasFacade) {
    generateFiles(
      tree,
      join(__dirname, 'files', 'facades'),
      entityDir,
      {
        name: fileName,
        classifyName: className,
        propertyName: propertyName,
        description: options.description || '',
        entityType,
        hasEffects,
        hasFacade,
        hasTests,
        createModel,
        tmpl: '',
      }
    );
  }

  // Generar pruebas si se solicitan
  if (hasTests) {
    const testsBaseDir = 'libs/state/src/tests';
    const testsEntityDir = joinPathFragments(testsBaseDir, fileName);
    
    // Generar pruebas de estado
    generateFiles(
      tree,
      join(__dirname, 'files', 'tests', 'states'),
      testsEntityDir,
      {
        name: fileName,
        classifyName: className,
        propertyName: propertyName,
        description: options.description || '',
        entityType,
        hasEffects,
        hasFacade,
        hasTests,
        createModel,
        tmpl: '',
      }
    );

    // Generar pruebas de acciones
    generateFiles(
      tree,
      join(__dirname, 'files', 'tests', 'actions'),
      testsEntityDir,
      {
        name: fileName,
        classifyName: className,
        propertyName: propertyName,
        description: options.description || '',
        entityType,
        hasEffects,
        hasFacade,
        hasTests,
        createModel,
        tmpl: '',
      }
    );

    // Generar pruebas de reducer
    generateFiles(
      tree,
      join(__dirname, 'files', 'tests', 'reducers'),
      testsEntityDir,
      {
        name: fileName,
        classifyName: className,
        propertyName: propertyName,
        description: options.description || '',
        entityType,
        hasEffects,
        hasFacade,
        hasTests,
        createModel,
        tmpl: '',
      }
    );

    // Generar pruebas de selectores
    generateFiles(
      tree,
      join(__dirname, 'files', 'tests', 'selectors'),
      testsEntityDir,
      {
        name: fileName,
        classifyName: className,
        propertyName: propertyName,
        description: options.description || '',
        entityType,
        hasEffects,
        hasFacade,
        hasTests,
        createModel,
        tmpl: '',
      }
    );

    // Generar pruebas de facade si se solicita
    if (hasFacade) {
      generateFiles(
        tree,
        join(__dirname, 'files', 'tests', 'facades'),
        testsEntityDir,
        {
          name: fileName,
          classifyName: className,
          propertyName: propertyName,
          description: options.description || '',
          entityType,
          hasEffects,
          hasFacade,
          hasTests,
          createModel,
          tmpl: '',
        }
      );
    }

    // Generar pruebas de efectos solo si se solicitan
    if (hasEffects) {
      generateFiles(
        tree,
        join(__dirname, 'files', 'tests', 'effects'),
        testsEntityDir,
        {
          name: fileName,
          classifyName: className,
          propertyName: propertyName,
          description: options.description || '',
          entityType,
          hasEffects,
          hasFacade,
          hasTests,
          createModel,
          tmpl: '',
        }
      );
    }

    // Crear archivo index.ts para las pruebas de la entidad
    createTestsIndexFile(tree, { fileName, className }, testsEntityDir, hasEffects, hasFacade);
  }

  // Crear archivo index.ts para la entidad
  createEntityIndexFile(tree, { fileName, className }, entityDir, hasEffects, hasFacade);

  // Crear modelo si se solicita
  if (createModel) {
    console.log(`🔄 Creando modelo para ${fileName} usando la convención del proyecto...`);
    
    // Crear modelo en la librería de modelos
    createModelForProject(tree, { fileName, className }, options.description || '');
    
    console.log(`✅ Modelo creado exitosamente para ${fileName}`);
  }

  // Actualizar el archivo index.ts principal de la librería state
  updateStateLibraryIndex(tree, { fileName, className }, hasEffects);

  // Registrar en app.reducers y app.state si se solicita
  if (registerInApp) {
    updateAppReducers(tree, { fileName, className });
    updateAppState(tree, { fileName, className });
  }

  await formatFiles(tree);
}

function createEntityIndexFile(tree: Tree, entityNames: any, entityDir: string, hasEffects: boolean, hasFacade: boolean) {
  const indexPath = joinPathFragments(entityDir, 'index.ts');
  
  let content = `// ${entityNames.className} State Management
// Generated by @create-ngrx-state generator

// State
export * from './${entityNames.fileName}.state';

// Actions
export * from './${entityNames.fileName}.actions';

// Reducer
export * from './${entityNames.fileName}.reducer';

// Selectors
export * from './${entityNames.fileName}.selectors';

`;

  if (hasEffects) {
    content += `// Effects
export * from './${entityNames.fileName}.effects';

`;
  }

  if (hasFacade) {
    content += `// Facade Service
export * from './${entityNames.fileName}-facade.service';
`;
  }

  tree.write(indexPath, content);
}

function createTestsIndexFile(
  tree: Tree,
  entityNames: { fileName: string; className: string },
  testsEntityDir: string,
  hasEffects: boolean,
  hasFacade: boolean
) {
  const indexPath = joinPathFragments(testsEntityDir, 'index.ts');

  let content = `// ${entityNames.className} Tests
// Generated by @create-ngrx-state generator

// State Tests
export * from './${entityNames.fileName}.state.spec';

// Actions Tests
export * from './${entityNames.fileName}.actions.spec';

// Reducer Tests
export * from './${entityNames.fileName}.reducer.spec';

// Selectors Tests
export * from './${entityNames.fileName}.selectors.spec';
`;

  if (hasEffects) {
    content += `
// Effects Tests
export * from './${entityNames.fileName}.effects.spec';
`;
  }
  if (hasFacade) {
    content += `
// Facade Service Tests
export * from './${entityNames.fileName}-facade.service.spec';
`;
  }

  tree.write(indexPath, content);
}

function createModelForProject(tree: Tree, entityNames: any, description: string) {
  const modelsLibDir = 'libs/models/src/lib';
  const modelContent = generateModelContent(entityNames, description);
  const modelPath = joinPathFragments(modelsLibDir, `${entityNames.fileName}.model.ts`);
  tree.write(modelPath, modelContent);

  // Actualizar index.ts de modelos
  updateModelsIndex(tree, entityNames);
}

function generateModelContent(entityNames: any, description: string): string {
  return `export interface ${entityNames.className} {
  id: string;
  // TODO: define fields according to your needs
  // Example fields:
  // name: string;
  // description: string;
  // created_at: number;
  // updated_at: number;
}`;
}

function updateModelsIndex(tree: Tree, entityNames: any) {
  const indexPath = 'libs/models/src/index.ts';

  if (!tree.exists(indexPath)) {
    console.warn(`Archivo ${indexPath} no encontrado. No se pudo actualizar.`);
    return;
  }

  let content = tree.read(indexPath, 'utf-8');

  const relativePath = `./lib/${entityNames.fileName}.model`;
  const exportLine = `export * from '${relativePath}';\n`;

  if (!content.includes(exportLine.trim())) {
    content = content + exportLine;
  }

  tree.write(indexPath, content);
}

function updateStateLibraryIndex(
  tree: Tree,
  entityNames: { fileName: string; className: string },
  hasEffects: boolean
) {
  const indexPath = 'libs/state/src/index.ts';

  if (!tree.exists(indexPath)) {
    console.warn(`Archivo ${indexPath} no encontrado. No se pudo actualizar.`);
    return;
  }

  let content = tree.read(indexPath, 'utf-8');

  // Agregar export de la nueva entidad en la sección features
  const exportLine = `export * from './lib/${entityNames.fileName}';\n`;

  if (!content.includes(exportLine.trim())) {
    const lines = content.split('\n');
    let insertIndex = lines.length - 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('export * from \'./lib/')) {
        insertIndex = i + 1;
        break;
      }
    }
    lines.splice(insertIndex, 0, exportLine.trim());
    content = lines.join('\n');
  }

  // Si tiene effects, agregar al array EFFECTS
  if (hasEffects) {
    const effectsArrayRegex = /export const EFFECTS = \[([\s\S]*?)\];/;
    const newEffectsImport = `import { ${entityNames.className}Effects } from './lib/${entityNames.fileName}';`;
    const newEffectsEntry = `${entityNames.className}Effects`;

    if (!content.includes(newEffectsEntry)) {
      const lines = content.split('\n');
      let lastImportIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ') && lines[i].includes("from './lib/")) {
          lastImportIndex = i;
        }
      }
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, newEffectsImport);
        content = lines.join('\n');
      }

      const arrayMatch = content.match(effectsArrayRegex);
      if (arrayMatch && !arrayMatch[1].includes(newEffectsEntry)) {
        const arrayContent = arrayMatch[1].trim();
        const newArrayContent = arrayContent
          ? `${arrayContent},\n  ${newEffectsEntry}`
          : newEffectsEntry;
        content = content.replace(effectsArrayRegex, `export const EFFECTS = [\n  ${newArrayContent}\n];`);
      }
    }
  }

  tree.write(indexPath, content);
}

function updateAppReducers(tree: Tree, entityNames: { fileName: string; className: string }) {
  const indexPath = 'libs/state/src/lib/app.reducers.ts';

  if (!tree.exists(indexPath)) {
    console.warn(`Archivo ${indexPath} no encontrado. No se pudo actualizar.`);
    return;
  }

  let content = tree.read(indexPath, 'utf-8');
  const reducerName = `${entityNames.fileName}Reducer`;
  const importLine = `import { ${reducerName} } from './${entityNames.fileName}';\n`;

  if (content.includes(reducerName)) return;

  // Añadir import después del último import de reducer (./plan o similar)
  const lastReducerImportMatch = content.match(/import \{ \w+Reducer \} from '\.\/[^']+';/g);
  if (lastReducerImportMatch) {
    const lastImport = lastReducerImportMatch[lastReducerImportMatch.length - 1];
    content = content.replace(lastImport, `${lastImport}\n${importLine.trim()}`);
  }

  // Añadir al ActionReducerMap: insertar antes de "};"
  const sliceKey = entityNames.fileName;
  if (content.includes(`${sliceKey}:`)) return;
  const lines = content.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '};') {
      lines.splice(i, 0, `  ${sliceKey}: ${reducerName},`);
      break;
    }
  }
  content = lines.join('\n');
  tree.write(indexPath, content);
}

function updateAppState(tree: Tree, entityNames: { fileName: string; className: string }) {
  const indexPath = 'libs/state/src/lib/app.state.ts';

  if (!tree.exists(indexPath)) {
    console.warn(`Archivo ${indexPath} no encontrado. No se pudo actualizar.`);
    return;
  }

  let content = tree.read(indexPath, 'utf-8');
  const stateType = `${entityNames.className}State`;
  const importLine = `import { ${stateType} } from './${entityNames.fileName}';\n`;

  if (content.includes(stateType)) return;

  const lastStateImportMatch = content.match(/import \{ \w+State \} from '\.\/[^']+';/g);
  if (lastStateImportMatch) {
    const lastImport = lastStateImportMatch[lastStateImportMatch.length - 1];
    content = content.replace(lastImport, `${lastImport}\n${importLine.trim()}`);
  }

  const sliceKey = entityNames.fileName;
  if (content.includes(`${sliceKey}:`)) return;
  const lines = content.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '}' && lines[i - 1]?.includes('State')) {
      lines.splice(i, 0, `  ${sliceKey}: ${stateType};`);
      break;
    }
  }
  content = lines.join('\n');
  tree.write(indexPath, content);
}
