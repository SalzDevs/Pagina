export interface LinkBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Link {
  href: string;
  bounds: LinkBounds[];
}
