import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-king-avatar',
  templateUrl: './king-avatar.component.html',
  styleUrls: ['./king-avatar.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class KingAvatarComponent {
  @Input() currentColorInBoard: 'white' | 'black' = 'white';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() showLabel = false;
  @Input() showRecord = false;
  @Input() bestScore = 0;

  getSizeClasses(): string {
    switch (this.size) {
      case 'sm':
        return 'w-12 h-12';
      case 'lg':
        return 'w-20 h-20';
      default:
        return 'w-16 h-16';
    }
  }

  getRingSize(): string {
    switch (this.size) {
      case 'sm':
        return 'ring-1 ring-offset-1';
      case 'lg':
        return 'ring-4 ring-offset-4';
      default:
        return 'ring-2 ring-offset-2';
    }
  }
}
