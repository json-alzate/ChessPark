import { Directive, ElementRef, OnInit } from '@angular/core';

@Directive({
  selector: '[appThemeApply]',
  standalone: true,
})
export class ThemeApplyDirective implements OnInit {
  constructor(private el: ElementRef) {}

  ngOnInit() {
    const theme = localStorage.getItem('selected-theme') || 'halloween';
    console.log('theme', theme);
    this.el.nativeElement.setAttribute('data-theme', theme);
  }
} 