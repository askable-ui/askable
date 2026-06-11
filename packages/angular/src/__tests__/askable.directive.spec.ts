import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AskableDirective } from '../askable.directive.js';

@Component({
  standalone: true,
  imports: [AskableDirective],
  template: `
    <button [askable]="meta" askableScope="kpis">Revenue</button>
    <div [askable]="plainStr">Plain</div>
    <span askable="">Empty</span>
  `,
})
class TestHostComponent {
  meta = { metric: 'revenue', value: '$1.2M' };
  plainStr = 'just a string';
}

describe('AskableDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
  });

  it('serialises object meta to JSON on data-askable', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLElement;
    expect(btn.dataset['askable']).toBe(JSON.stringify({ metric: 'revenue', value: '$1.2M' }));
  });

  it('passes string meta verbatim', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const div = fixture.debugElement.query(By.css('div')).nativeElement as HTMLElement;
    expect(div.dataset['askable']).toBe('just a string');
  });

  it('sets data-askable-scope', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLElement;
    expect(btn.dataset['askableScope']).toBe('kpis');
  });

  it('updates data-askable when meta changes', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    fixture.componentInstance.meta = { metric: 'revenue', value: '$2.0M' };
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLElement;
    expect(btn.dataset['askable']).toBe(JSON.stringify({ metric: 'revenue', value: '$2.0M' }));
  });
});
