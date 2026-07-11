import * as parse5 from "parse5";

export function parseHTML(html: string) {
    return parse5.parse(html);
}
