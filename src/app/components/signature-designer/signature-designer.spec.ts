import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignatureDesigner } from './signature-designer';

describe('SignatureDesigner', () => {
  let component: SignatureDesigner;
  let fixture: ComponentFixture<SignatureDesigner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignatureDesigner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignatureDesigner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
