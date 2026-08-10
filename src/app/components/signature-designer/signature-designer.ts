import { AfterViewInit, Component, HostListener } from '@angular/core';
import { Canvas, FabricImage, Textbox, Rect, Circle, Line, Triangle, FabricObject, ActiveSelection } from 'fabric';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef } from '@angular/material/dialog';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Inject } from '@angular/core';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-signature-designer',
  standalone: true,
  templateUrl: './signature-designer.html',
  styleUrl: './signature-designer.scss',
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatDialogModule,
    MatInputModule,
    MatMenuModule
  ]
})
export class SignatureDesignerComponent implements AfterViewInit {

  // Signature metadata
  signatureName: string = '';

  canvas!: Canvas;
  activeObject: any = null;
  
  // MS Word style clipboard buffer
  private _clipboard: any = null;
  private _textClipboard: string = '';
  

  canvasLoaded = false;

  zoom = 1;

  fontFamily = 'Arial';
  fontSize = 20;
  fontColor = '#000000';
  fillColor = '#ffffff';

  fontSizes = [
    8, 9, 10, 11, 12, 14, 16, 18,
    20, 22, 24, 26, 28, 32, 36,
    40, 48, 56, 72
  ];

  activeTab: 'format' | 'insert' = 'format';

  ngAfterViewInit() {
    this.canvas = new Canvas('signatureCanvas', {
      width: 900,
      height: 300,
      backgroundColor: '#fff',
      preserveObjectStacking: true
    });
    this.registerCanvasEvents();
      // Load saved design
  if (this.data?.canvasJson) 
    {
    this.canvas.loadFromJSON(this.data.canvasJson).then(() =>
      {
      this.canvas.requestRenderAll();
       this.canvasLoaded = true;
    });
  }else {
    this.canvasLoaded = true;
  }
  }

  constructor(
  private dialogRef: MatDialogRef<SignatureDesignerComponent>,
  @Inject(MAT_DIALOG_DATA) public data: any) {}

  registerCanvasEvents() {
    // Sync state controls when an object is selected
    this.canvas.on('selection:created', (e: any) => this.handleSelection(e));
    this.canvas.on('selection:updated', (e: any) => this.handleSelection(e));
    this.canvas.on('selection:cleared', () => {
      this.activeObject = null;
    });
  }

  private handleSelection(e: any) {
    this.activeObject = e.selected[0];
    if (this.activeObject && this.isTextbox(this.activeObject)) {
      this.fontFamily = this.activeObject.fontFamily || 'Arial';
      this.fontSize = this.activeObject.fontSize || 20;
      this.fontColor = (this.activeObject.fill as string) || '#000000';
      this.fillColor = (this.activeObject.backgroundColor as string) || '#ffffff';
    }
  }

  get active() {
    return this.activeObject;
  }

  private isTextbox(obj: any): obj is Textbox {
    return obj && (obj.type === 'textbox' || obj.isType?.('textbox'));
  }

  render() {
    this.canvas.requestRenderAll();
  }

  // ==========================================
  // MS Word Style Clipboard Operations
  // ==========================================

  /**
   * Serializes and clones the currently active object or multi-selection into memory.
   */

async cutObject() {

  const activeObject = this.canvas.getActiveObject();

  if (!activeObject) {
    return;
  }

  // =====================================================
  // TEXTBOX - CUT SELECTED TEXT
  // =====================================================

  if (this.isTextbox(activeObject) && activeObject.isEditing) {

    const start = activeObject.selectionStart ?? 0;
    const end = activeObject.selectionEnd ?? 0;

    // Nothing selected inside the textbox
    if (start === end) {
      return;
    }

    const text = activeObject.text || '';

    // Store selected text in clipboard
    const selectedText = text.substring(start, end);

    // Save selected text separately
    this._textClipboard = selectedText;

    // Also try to put it into the system clipboard
    try {
      await navigator.clipboard.writeText(selectedText);
    } catch (err) {
      console.warn('Unable to write text to system clipboard');
    }

    // Remove selected text
    const newText =
      text.substring(0, start) +
      text.substring(end);

    activeObject.set('text', newText);

    // Move cursor to where the text was removed
    activeObject.selectionStart = start;
    activeObject.selectionEnd = start;

    activeObject.setCoords();

    this.canvas.requestRenderAll();

    return;
  }

  // =====================================================
  // NORMAL FABRIC OBJECT - CUT WHOLE OBJECT
  // =====================================================

  this._clipboard = await activeObject.clone();

  this.canvas.remove(activeObject);

  this.canvas.discardActiveObject();

  this.activeObject = null;

  this.canvas.requestRenderAll();
}
async copy() {

  const targetObj = this.canvas?.getActiveObject();

  if (!targetObj) {
    return;
  }

  // =====================================================
  // TEXTBOX - COPY SELECTED TEXT
  // =====================================================

  if (this.isTextbox(targetObj) && targetObj.isEditing) {

    const start = targetObj.selectionStart ?? 0;
    const end = targetObj.selectionEnd ?? 0;

    if (start === end) {
      return;
    }

    const text = targetObj.text || '';

    const selectedText = text.substring(start, end);

    this._textClipboard = selectedText;

    try {
      await navigator.clipboard.writeText(selectedText);
    } catch (err) {
      console.warn('Unable to write text to system clipboard');
    }

    return;
  }

  // =====================================================
  // NORMAL FABRIC OBJECT
  // =====================================================

  this._clipboard = await targetObj.clone();
}

  /**
   * Deserializes, offsets, adds to canvas, and selects the pasted instance.
   */
  // async paste() {
  //   if (!this._clipboard) return;

  //   // Clone clipboard payload to allow multiple independent paste actions
  //   const clonedObj = await this._clipboard.clone();

  //   this.canvas.discardActiveObject(); // Clear existing active selection

  //   // Calculate dynamic offset (simulates MS Word cascade placement)
  //   const OFFSET = 15;
  //   clonedObj.set({
  //     left: clonedObj.left + OFFSET,
  //     top: clonedObj.top + OFFSET,
  //     evented: true,
  //   });

  //   // Handle multi-selection paste payload
  //   if (clonedObj.type === 'activeSelection') {
  //     clonedObj.canvas = this.canvas;
  //     clonedObj.forEachObject((obj: any) => {
  //       this.canvas.add(obj);
  //     });
  //     clonedObj.setCoordinates();
  //   } else {
  //     // Single object paste payload
  //     this.canvas.add(clonedObj);
  //   }

  //   // Shift clipboard anchor so consecutive pastes stagger automatically
  //   this._clipboard.top += OFFSET;
  //   this._clipboard.left += OFFSET;

  //   // Automatically focus newly pasted object(s)
  //   this.canvas.setActiveObject(clonedObj);
  //   this.render();
  // }

  async paste() {

  // =====================================================
  // PASTE TEXT INTO CURRENT TEXTBOX
  // =====================================================

  const activeObject = this.canvas.getActiveObject();

  if (
    this._textClipboard &&
    this.isTextbox(activeObject) &&
    activeObject.isEditing
  ) {

    const start = activeObject.selectionStart ?? 0;
    const end = activeObject.selectionEnd ?? 0;

    const text = activeObject.text || '';

    const newText =
      text.substring(0, start) +
      this._textClipboard +
      text.substring(end);

    activeObject.set('text', newText);

    const newCursorPosition =
      start + this._textClipboard.length;

    activeObject.selectionStart = newCursorPosition;
    activeObject.selectionEnd = newCursorPosition;

    this.canvas.requestRenderAll();

    return;
  }

  // =====================================================
  // NORMAL FABRIC OBJECT PASTE
  // =====================================================

  if (!this._clipboard) {
    return;
  }

  const clonedObj = await this._clipboard.clone();

  this.canvas.discardActiveObject();

  const OFFSET = 15;

  clonedObj.set({
    left: clonedObj.left + OFFSET,
    top: clonedObj.top + OFFSET,
    evented: true
  });

  if (clonedObj.type === 'activeSelection') {

    clonedObj.canvas = this.canvas;

    clonedObj.forEachObject((obj: any) => {
      this.canvas.add(obj);
    });

    clonedObj.setCoordinates();

  } else {

    this.canvas.add(clonedObj);
  }

  this._clipboard.top += OFFSET;
  this._clipboard.left += OFFSET;

  this.canvas.setActiveObject(clonedObj);

  this.render();
}

  // Alias methods for UI Toolbar integration
  copyObject() {
    this.copy();
  }

  pasteObject() {
    this.paste();
  }

  // Listen for global OS keyboard shortcuts (Ctrl+C, Ctrl+V, Cmd+C, Cmd+V)
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const target = event.target as HTMLElement;

    // Ignore keyboard shortcuts if focus is inside an HTML input, textarea, or contentEditable element
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    const isCtrlOrCmd = event.ctrlKey || event.metaKey;

    if (isCtrlOrCmd && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      this.copy();
    }

   if (isCtrlOrCmd && event.key.toLowerCase() === 'v') {
  event.preventDefault();

  // First try Fabric clipboard
  if (this._clipboard) {
    this.paste();
    return;
  }
   // Otherwise paste from system/browser clipboard
  this.pasteFromSystemClipboard(event);

    // Otherwise read system clipboard
  // this.pasteFromClipboard();
}
  }

  async pasteFromClipboard() {
  if (!navigator.clipboard) {
    return;
  }

  try {

    const items = await navigator.clipboard.read();
    for (const item of items) {
      // -----------------------------
      // IMAGE
      // -----------------------------
      const imageType = item.types.find(type => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const url = URL.createObjectURL(blob);
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        img.set({
          left: 200,
          top: 250,
          scaleX: 0.5,
          scaleY: 0.5
        });
        this.canvas.add(img);
        this.canvas.setActiveObject(img);
        this.render();
        URL.revokeObjectURL(url);
        return;
      }

      // -----------------------------
      // TEXT
      // -----------------------------
      if (item.types.includes('text/plain')) {
        const blob = await item.getType('text/plain');
        const text = await blob.text();
        const textbox = new Textbox(text, {
          left: 220,
          top: 250,
          width: 300,
          editable: true,
          fontFamily: this.fontFamily,
          fontSize: this.fontSize,
          fill: this.fontColor
        });
        this.canvas.add(textbox);
        this.canvas.setActiveObject(textbox);
        this.render();
        return;
      }
    }
  }
  catch (err) {
    console.error(err);
  }

}

async pasteFromSystemClipboard(event?: KeyboardEvent) {

  if (!navigator.clipboard || !navigator.clipboard.read) {
    await this.pasteFromClipboard();
    return;
  }

  try {
    const clipboardItems = await navigator.clipboard.read();
    let htmlFound = false;
    for (const item of clipboardItems) {
      // ==================================================
      // HTML - Word / Browser / Outlook / Gmail
      // ==================================================
      if (item.types.includes('text/html')) {

        htmlFound = true;

        const blob = await item.getType('text/html');
        const html = await blob.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // --------------------------------------------------
        // ROW POSITIONING
        // --------------------------------------------------

        let currentLeft = 50;
        const currentTop = 100;
        const GAP = 20;

        // ==================================================
        // IMAGES
        // ==================================================

        const images = Array.from(doc.querySelectorAll('img'));
        for (const image of images) {
          const src = image.getAttribute('src');
          if (!src) {
            continue;
          }

          try {

            const fabricImg = await FabricImage.fromURL(src, {
              crossOrigin: 'anonymous'
            });

            fabricImg.set({
              left: currentLeft,
              top: currentTop,
              scaleX: 1,
              scaleY: 1,
              evented: true
            });

            this.canvas.add(fabricImg);

            // Move NEXT image to the RIGHT
            currentLeft += (fabricImg.getScaledWidth() || 100) + GAP;

          }
          catch (e) {
            console.warn(
              'Unable to load image',
              e
            );
          }
        }

        // ==================================================
        // TEXT
        // ==================================================

        const text = doc.body.innerText.trim();
        if (text.length) {
          const textbox = new Textbox(text, {
            left: currentLeft,
            top: currentTop,
            width: 300,
            editable: true,
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fill: this.fontColor
          });

          this.canvas.add(textbox);

          this.canvas.setActiveObject(textbox);
        }

        this.render();

        return;
      }
    }

    // ==================================================
    // NO HTML
    // ==================================================

    if (!htmlFound) {
      await this.pasteFromClipboard();
    }

  }
  catch (err) {

    console.error(
      'System clipboard paste failed:',
      err
    );

    await this.pasteFromClipboard();
  }
}

@HostListener('window:paste', ['$event'])
async onPaste(event: ClipboardEvent) {
    console.log("Clipboard Types:", event.clipboardData?.types);
  const clipboardData = event.clipboardData;
  if (!clipboardData) {
    return;
  }

  // Prevent browser from pasting into page
  event.preventDefault();

  // --------------------
  // IMAGE
  // --------------------

  for (const item of clipboardData.items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (!blob) {
        continue;
      }
      const url = URL.createObjectURL(blob);
const img = await FabricImage.fromURL(url, {
  crossOrigin: 'anonymous'
});      img.set({
        left: 400,
        top: 250,
        scaleX: 0.5,
        scaleY: 0.5
      });
      this.canvas.add(img);
      this.canvas.setActiveObject(img);
      this.render();
      URL.revokeObjectURL(url);
      return;
    }
  }

  // --------------------
  // TEXT
  // --------------------
  const text = clipboardData.getData('text');
  if (text) {
    const textbox = new Textbox(text, {
      left: 220,
      top: 250,
      width: 300,
      editable: true,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fill: this.fontColor
    });
    this.canvas.add(textbox);
    this.canvas.setActiveObject(textbox);
    this.render();
  }
}



// ==========================================================
// TEXT SELECTION HELPERS
// ==========================================================

private getTextSelectionRange(textbox: Textbox) {
  const start = textbox.selectionStart ?? 0;
  const end = textbox.selectionEnd ?? 0;

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
    hasSelection: start !== end
  };
}

/**
 * Apply a style either to the selected characters
 * or to the complete textbox when nothing is selected.
 */
private applyTextStyle(style: any) {

  if (!this.isTextbox(this.active)) {
    return;
  }

  const textbox = this.active as Textbox;
  const { start, end, hasSelection } =
    this.getTextSelectionRange(textbox);

  // --------------------------------------------------
  // PART OF TEXT SELECTED
  // --------------------------------------------------
  if (textbox.isEditing && hasSelection) {

    textbox.setSelectionStyles(style, start, end);

    // Keep the current text selection
    textbox.selectionStart = start;
    textbox.selectionEnd = end;

  }

  // --------------------------------------------------
  // WHOLE TEXTBOX
  // --------------------------------------------------
  else {

    textbox.set(style);
  }

  textbox.setCoords();
  this.canvas.requestRenderAll();
}


/**
 * Get the style of the first selected character.
 * Used for toggling Bold / Italic / Underline / Strike.
 */
private getSelectedCharacterStyle(property: string): any {

  if (!this.isTextbox(this.active)) {
    return undefined;
  }

  const textbox = this.active as Textbox;

  const { start, end, hasSelection } =
    this.getTextSelectionRange(textbox);

  // If a part is selected, inspect the first character.
  if (textbox.isEditing && hasSelection) {

    const styles = textbox.getSelectionStyles(start, end);

    if (styles.length > 0) {
      return (styles[0] as any)[property];
    }
  }

  // Otherwise inspect the textbox-level style.
  return (textbox as any)[property];
}



  // ==========================================
  // Font & Sizing Controls
  // ==========================================

  changeFontFamily() {
    if (this.isTextbox(this.active)) {
      this.active.set('fontFamily', this.fontFamily);
      this.render();
    }
  }

changeFontSize() {

  const size = Number(this.fontSize);

  if (!size || size < 1) {
    return;
  }

  this.fontSize = size;

  if (!this.isTextbox(this.active)) {
    return;
  }

  const textbox = this.active as Textbox;

  const { start, end, hasSelection } =
    this.getTextSelectionRange(textbox);

  // Selected characters only
  if (textbox.isEditing && hasSelection) {

    textbox.setSelectionStyles(
      {
        fontSize: size
      },
      start,
      end
    );

    textbox.selectionStart = start;
    textbox.selectionEnd = end;

  }
  // No selection -> whole textbox
  else {

    textbox.set({
      fontSize: size
    });
  }

  textbox.setCoords();
  this.canvas.requestRenderAll();
}


increaseFont() {

  if (!this.isTextbox(this.active)) {
    return;
  }

  const textbox = this.active as Textbox;

  const { start, end, hasSelection } =
    this.getTextSelectionRange(textbox);

  // Get current size
  let currentSize = this.fontSize;

  if (textbox.isEditing && hasSelection) {

    const styles = textbox.getSelectionStyles(start, end);

    if (styles.length > 0 && styles[0].fontSize) {
      currentSize = Number(styles[0].fontSize);
    }

  } else {

    currentSize = Number(textbox.fontSize || this.fontSize);
  }

  const nextSize = currentSize + 1;

  this.fontSize = nextSize;

  // Selected characters
  if (textbox.isEditing && hasSelection) {

    textbox.setSelectionStyles(
      {
        fontSize: nextSize
      },
      start,
      end
    );

    textbox.selectionStart = start;
    textbox.selectionEnd = end;

  }

  // Whole textbox
  else {

    textbox.set({
      fontSize: nextSize
    });
  }

  textbox.setCoords();
  this.canvas.requestRenderAll();
}


decreaseFont() {

  if (!this.isTextbox(this.active)) {
    return;
  }

  const textbox = this.active as Textbox;

  const { start, end, hasSelection } =
    this.getTextSelectionRange(textbox);

  let currentSize = this.fontSize;

  if (textbox.isEditing && hasSelection) {

    const styles = textbox.getSelectionStyles(start, end);

    if (styles.length > 0 && styles[0].fontSize) {
      currentSize = Number(styles[0].fontSize);
    }

  } else {

    currentSize = Number(textbox.fontSize || this.fontSize);
  }

  const nextSize = Math.max(1, currentSize - 1);

  this.fontSize = nextSize;

  // Selected characters
  if (textbox.isEditing && hasSelection) {

    textbox.setSelectionStyles(
      {
        fontSize: nextSize
      },
      start,
      end
    );

    textbox.selectionStart = start;
    textbox.selectionEnd = end;

  }

  // Whole textbox
  else {

    textbox.set({
      fontSize: nextSize
    });
  }

  textbox.setCoords();
  this.canvas.requestRenderAll();
}

  clearFormatting() {
    if (this.isTextbox(this.active)) {
      this.fontFamily = 'Arial';
      this.fontSize = 20;
      this.fontColor = '#000000';
      this.fillColor = '#ffffff';

      this.active.set({
        fontFamily: 'Arial',
        fontSize: 20,
        fill: '#000000',
        backgroundColor: '',
        fontWeight: 'normal',
        fontStyle: 'normal',
        underline: false,
        linethrough: false,
        textAlign: 'left'
      });
      this.render();
    }
  }

  // ==========================================
  // Text Styling & Color Controls
  // ==========================================

toggleBold() {
  if (!this.isTextbox(this.active)) {
    return;
  }
  const currentWeight =
    this.getSelectedCharacterStyle('fontWeight');
  const newWeight =
    currentWeight === 'bold'
      ? 'normal'
      : 'bold';
  this.applyTextStyle({
    fontWeight: newWeight
  });
}


toggleItalic() {
  if (!this.isTextbox(this.active)) {
    return;
  }
  const currentStyle =
    this.getSelectedCharacterStyle('fontStyle');
  const newStyle =
    currentStyle === 'italic'
      ? 'normal'
      : 'italic';
  this.applyTextStyle({
    fontStyle: newStyle
  });
}


toggleUnderline() {
  if (!this.isTextbox(this.active)) {
    return;
  }
  const currentUnderline =
    this.getSelectedCharacterStyle('underline');
  this.applyTextStyle({
    underline: !currentUnderline
  });
}


toggleStrike() {
  if (!this.isTextbox(this.active)) {
    return;
  }
  const currentStrike =
    this.getSelectedCharacterStyle('linethrough');
  this.applyTextStyle({
    linethrough: !currentStrike
  });
}


changeFontColor() {
  if (!this.isTextbox(this.active)) {
    return;
  }
  this.applyTextStyle({
    fill: this.fontColor
  });
}


changeFillColor() {
  if (!this.isTextbox(this.active)) {
    return;
  }
  this.applyTextStyle({
    backgroundColor: this.fillColor
  });
}

  // ==========================================
  // Text Alignment
  // ==========================================

  alignLeft() {
    if (this.isTextbox(this.active)) {
      this.active.set('textAlign', 'left');
      this.render();
    }
  }

  alignCenter() {
    if (this.isTextbox(this.active)) {
      this.active.set('textAlign', 'center');
      this.render();
    }
  }

  alignRight() {
    if (this.isTextbox(this.active)) {
      this.active.set('textAlign', 'right');
      this.render();
    }
  }

  alignJustify() {
    if (this.isTextbox(this.active)) {
      this.active.set('textAlign', 'justify');
      this.render();
    }
  }

  // ==========================================
  // Lists
  // ==========================================

  bulletList() {
    if (!this.isTextbox(this.active)) return;
    const text = this.active.text || '';
    const lines = text.split('\n');
    const updatedLines = lines.map((line) => {
      const cleanLine = line.replace(/^(\u2022|\d+\.)\s*/, '');
      return `• ${cleanLine}`;
    });
    this.active.set('text', updatedLines.join('\n'));
    this.render();
  }

  numberList() {
    if (!this.isTextbox(this.active)) return;
    const text = this.active.text || '';
    const lines = text.split('\n');
    const updatedLines = lines.map((line, index) => {
      const cleanLine = line.replace(/^(\u2022|\d+\.)\s*/, '');
      return `${index + 1}. ${cleanLine}`;
    });
    this.active.set('text', updatedLines.join('\n'));
    this.render();
  }

  // ==========================================
  // Canvas Elements Addition Methods
  // ==========================================

  addText() {
    const text = new Textbox('Double click to edit', {
      left: 350,
      top: 220,
      width: 250,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fill: this.fontColor,
      editable: true
    });
    this.canvas.add(text);
    this.canvas.setActiveObject(text);
    this.render();
  }

  addLine() {
    const line = new Line([50, 50, 250, 50], {
      stroke: 'black',
      strokeWidth: 3
    });
    this.canvas.add(line);
    this.canvas.setActiveObject(line);
    this.render();
  }

  uploadImage(event: any) {
    const files = event.target.files;
    if (!files.length) return;

    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      reader.onload = async () => {
const img = await FabricImage.fromURL(
  reader.result as string,
  {
    crossOrigin: 'anonymous'
  }
);        img.set({
          left: 80 + i * 30,
          top: 80 + i * 30,
          scaleX: 0.35,
          scaleY: 0.35,
          cornerStyle: 'circle',
          transparentCorners: false
        });
        this.canvas.add(img);
        this.canvas.setActiveObject(img);
        this.render();
      };
      reader.readAsDataURL(files[i]);
    }
  }
downloadFile(type: string): void {
  if (type === 'json') {
    this.downloadCanvasJson();
  }
  else if (type === 'png') {
    this.downloadAsPNG();
  }
  else if (type === 'jpeg') {
    this.downloadAsJPEG();
  }
  else if (type === 'pdf') {
    this.downloadAsPDF();
  }
  else if (type === 'html') {
    this.downloadAsHTML();
  }

}

downloadAsPNG() {
  this.canvas.discardActiveObject();
  this.canvas.requestRenderAll();
const dataURL = this.canvas.toDataURL({ format: 'png', multiplier: 2 });
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'signature.png';
  a.click();
}

downloadAsJPEG() {
  this.canvas.discardActiveObject();
  this.canvas.requestRenderAll();
  const dataURL = this.canvas.toDataURL({ format: 'jpeg', quality: 1, multiplier: 2 });
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'signature.jpeg';
  a.click();
}

downloadAsPDF() {
  const pdf = new jsPDF();
  const img = this.canvas.toDataURL({ format: 'png', multiplier: 2 });
  pdf.addImage(img, 'PNG', 10, 10, 180, 60);
  pdf.save('signature.pdf');
}

downloadAsHTML() {

  const html = `
<!DOCTYPE html>
<html>
<head>
<title>Signature</title>
</head>
<body>
<img src="${this.canvas.toDataURL({ format: 'png',   multiplier: 2 })}" />
</body>
</html>`;
  const blob = new Blob([html], {
    type: 'text/html'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'signature.html';
  a.click();
  URL.revokeObjectURL(url);

}
  deleteObject() {
    if (!this.active) return;
    this.canvas.remove(this.active);
    this.activeObject = null;
    this.render();
  }

  duplicateObject() {
    if (!this.active) return;
    this.active.clone().then((obj: any) => {
      obj.left += 25;
      obj.top += 25;
      this.canvas.add(obj);
      this.canvas.setActiveObject(obj);
      this.render();
    });
  }

  // Layers & Object Transformations
  bringForward() {
    if (!this.active) return;
    this.canvas.bringObjectForward(this.active);
    this.render();
  }

  sendBackward() {
    if (!this.active) return;
    this.canvas.sendObjectBackwards(this.active);
    this.render();
  }

  bringToFront() {
    if (!this.active) return;
    this.canvas.bringObjectToFront(this.active);
    this.render();
  }

  sendToBack() {
    if (!this.active) return;
    this.canvas.sendObjectToBack(this.active);
    this.render();
  }

  rotateLeft() {
    if (!this.active) return;
    this.active.rotate((this.active.angle || 0) - 15);
    this.render();
  }

  rotateRight() {
    if (!this.active) return;
    this.active.rotate((this.active.angle || 0) + 15);
    this.render();
  }

  flipHorizontal() {
    if (!this.active) return;
    this.active.set({ flipX: !this.active.flipX });
    this.render();
  }

  flipVertical() {
    if (!this.active) return;
    this.active.set({ flipY: !this.active.flipY });
    this.render();
  }

  lockObject() {
    if (!this.active) return;
    this.active.set({
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true
    });
    this.canvas.discardActiveObject();
    this.render();
  }

  unlockAll() {
    this.canvas.forEachObject((obj: any) => {
      obj.set({
        selectable: true,
        evented: true,
        lockMovementX: false,
        lockMovementY: false,
        lockRotation: false,
        lockScalingX: false,
        lockScalingY: false
      });
    });
    this.render();
  }

  // Zooming
  zoomIn() {
    this.zoom += 0.1;
    this.canvas.setZoom(this.zoom);
  }

  zoomOut() {
    this.zoom -= 0.1;
    if (this.zoom < 0.3) {
      this.zoom = 0.3;
    }
    this.canvas.setZoom(this.zoom);
  }

  resetZoom() {
    this.zoom = 1;
    this.canvas.setZoom(1);
  }

  saveSignature() {

  // Serialize entire canvas
  const canvasJson = this.canvas.toJSON();

  this.dialogRef.close({
    name: this.signatureName,
    canvasJson: canvasJson
  });

}

downloadCanvasJson(): void {
  const canvasJson = this.canvas.toJSON();
  const jsonString = JSON.stringify(canvasJson, null, 2);
  const blob = new Blob([jsonString], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'signature.json';
  a.click();
  URL.revokeObjectURL(url);
}
}