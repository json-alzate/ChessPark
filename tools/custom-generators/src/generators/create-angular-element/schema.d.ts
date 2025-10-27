export interface CreateAngularElementSchema {
  projectType: 'app' | 'lib';
  projectName: string;
  elementType: 'component' | 'service' | 'guard' | 'directive' | 'pipe';
  path?: string;
  name: string;
  standalone?: boolean;
  skipTests?: boolean;
}
