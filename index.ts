import * as parse5 from "parse5"

function visit(node: any, depth = 0) {
    console.log(
        " ".repeat(depth * 2),
        node.nodeName,
        node.value ?? ""
    );

    if (node.childNodes) {
        for (const child of node.childNodes) {
            visit(child, depth + 1);
        }
    }
}


const html = `
<!DOCTYPE html>
<html>
  <body>
    <h1>Hello!</h1>
    <p>This is <strong>OpenTUI</strong>.</p>
  </body>
</html>
`;

const document = parse5.parse(html);
visit(document);
