import { toSVG } from 'bwip-js/node';

export function renderCode128Svg(text: string): string {
  return toSVG({
    bcid: 'code128',
    text,
    scale: 3,
    height: 15,
    includetext: false,
    paddingwidth: 10,
  });
}
