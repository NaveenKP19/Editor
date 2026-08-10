import { Component, signal } from '@angular/core';
import { SignatureDesignerComponent } from "./components/signature-designer/signature-designer";
// import { SuneditorComponent } from './components/suneditor/suneditor.component';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  // protected readonly title = signal('signatureeditor');
  signatureJson: any = null;

  constructor(private dialog: MatDialog) {}

  openSignatureDialog() {
  const savedCanvasJson = this.signatureJson; // from DB or variable
  const dialogRef = this.dialog.open(SignatureDesignerComponent, {
    width: '1000px',
    maxHeight: '95vh',
    maxWidth: '100vw',
    disableClose: false,
    panelClass: 'signature-dialog-panel',
    data : {
      canvasJson : savedCanvasJson
    }
  });

  dialogRef.afterClosed().subscribe(result => {

    if (!result) {
      return;
    }

    this.signatureJson =result.canvasJson;

    console.log('Signature Name:', result.name);
    console.log('Canvas JSON:', result.canvasJson);

    // Store it if needed
    // this.signatureJson = result.canvasJson;

    // Convert to string if sending to backend
    const jsonString = JSON.stringify(result.canvasJson);

    console.log(jsonString);

    // Example:
    // this.http.post('/api/signature', {
    //   name: result.name,
    //   signatureJson: jsonString
    // }).subscribe();
  });

}
}