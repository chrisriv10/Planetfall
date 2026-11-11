import {describe,expect,it} from "vitest";
import {homePreviewRegion} from "./home-preview-region";
describe("real menu panel preview space",()=>{
 it.each([[1366,768],[1600,900],[1920,1080],[3440,1440]])("keeps home previews beside the actual card at %sx%s",(width,height)=>{
  const panel={left:width*.07,top:40,right:width*.07+570},region=homePreviewRegion(width,height,panel)!;
  expect(region.left).toBeGreaterThan(panel.right);expect(region.left+region.width).toBeLessThan(width);expect(region.top+region.height).toBeLessThan(height);
 });
 it("follows a short landscape sidebar and the real footer",()=>{
  const region=homePreviewRegion(864,540,{left:437,top:12,right:852},true,460)!;
  expect(region.left+region.width).toBeLessThan(437);expect(region.top+region.height).toBeLessThan(460);expect(region.height).toBeGreaterThan(300);
 });
 it("uses available portrait headspace and declines space obscured by a home card",()=>{
  const region=homePreviewRegion(390,844,{left:12,top:276,right:378},true,720)!;
  expect(region.top+region.height).toBeLessThan(276);expect(region.width).toBeGreaterThan(300);
  expect(homePreviewRegion(390,844,{left:16,top:40,right:374})).toBeNull();
  expect(homePreviewRegion(NaN,844,{left:12,top:276,right:378})).toBeNull();
 });
});
