import { StaticsComponent } from './statics/statics.component';
import { BlockSettingsComponent } from './block-settings/block-settings.component';
import { BoardPuzzleComponent } from './board-puzzle/board-puzzle.component';
import { ActivityChartComponent } from './activity-chart/activity-chart.component';
import { BlockPresentationComponent } from './block-presentation/block-presentation.component';
import { PuzzleSolutionComponent } from './puzzle-solution/puzzle-solution.component';
import { PlanChartComponent } from './plan-chart/plan-chart.component';
import { PuzzlesPlayedPreviewComponent } from './puzzles-played-preview/puzzles-played-preview.component';

export const COMPONENTS = [
    StaticsComponent,
    BlockSettingsComponent,
    BoardPuzzleComponent,
    ActivityChartComponent,
    BlockPresentationComponent,
    PuzzleSolutionComponent,
    PlanChartComponent,
    PuzzlesPlayedPreviewComponent
];

export const ENTRY_COMPONENTS: any[] = [
    BlockPresentationComponent,
    PuzzleSolutionComponent,
    PlanChartComponent,
    BlockSettingsComponent
];
