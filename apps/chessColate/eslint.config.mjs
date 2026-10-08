import baseConfig from '../../eslint.config.mjs';

const REPOSITORY_MESSAGE =
  'Los componentes no acceden a Firestore. Leen y escriben a través de un facade ' +
  'o del store (libs/state): usa PublicPlansFacadeService, PlanFacadeService, etc. ' +
  'Los repositorios de services/ son la capa de datos y solo los usan los servicios y los puertos de libs/state.';

export default [
  ...baseConfig,
  {
    // Evita que una página o componente inyecte un repositorio o la conexión de Firestore
    // y se salte los facades. Así cada dato tiene un solo camino (store) y no dos.
    files: ['src/app/pages/**/*.ts', 'src/app/**/components/**/*.ts', 'src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*.repository', 'firestore-connection.service', 'public-plans-firestore.adapter'],
              message: REPOSITORY_MESSAGE,
            },
          ],
        },
      ],
    },
  },
];
