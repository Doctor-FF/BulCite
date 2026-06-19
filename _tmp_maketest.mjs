import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { writeFileSync } from "fs";
const doc = new Document({ sections: [{ properties: {}, children: [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Introduction", bold: true })] }),
  new Paragraph({ children: [
    new TextRun({ text: "Prior work [1] established the basis, and others [2,4] extended it. " }),
    new TextRun({ text: "Bold claim", bold: true }),
    new TextRun({ text: " was cited in [3-5]." }),
  ]}),
  new Paragraph({ children: [new TextRun({ text: "Plain paragraph with italic " }), new TextRun({ text: "emphasis", italics: true }), new TextRun({ text: " preserved and citation [6]." })] }),
]}]});
const buf = await Packer.toBuffer(doc);
writeFileSync("/tmp/test.docx", buf);
console.log("wrote /tmp/test.docx", buf.length);
