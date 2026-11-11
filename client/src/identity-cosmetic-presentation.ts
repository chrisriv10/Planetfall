import type {EquippedCosmetics} from "@planetfall/shared";
import {callingCardSvg,emblemSvg} from "./identity-cosmetic-art";
import "./identity-cosmetic-presentation.css";

type Equipment=Pick<EquippedCosmetics,"calling-card"|"emblem">;
interface Layers {card?:HTMLSpanElement;emblem?:HTMLSpanElement;cardId?:string;emblemId?:string}
const mounted=new WeakMap<HTMLElement,Layers>();

export function clearIdentityCosmeticPresentation(element:HTMLElement):void {
  const previous=mounted.get(element);
  if(!previous)return;
  previous.card?.remove();previous.emblem?.remove();
  element.classList.remove("pf-identity-surface","pf-identity-emblem-gutter");mounted.delete(element);
}

/** Apply to a roster/name container. An optional [data-identity-name] descendant receives the inline badge. */
export function applyIdentityCosmeticPresentation(element:HTMLElement,equipped?:Equipment):void {
  const cardId=equipped?.["calling-card"]??"",emblemId=equipped?.emblem??"";
  const card=callingCardSvg(cardId),emblem=emblemSvg(emblemId);
  if(!card&&!emblem){clearIdentityCosmeticPresentation(element);return;}
  let layers=mounted.get(element);
  if(!layers){layers={};mounted.set(element,layers);element.classList.add("pf-identity-surface");}
  function layer(className:string) {
    const span=element.ownerDocument.createElement("span");span.className=className;span.setAttribute("aria-hidden","true");
    return span;
  }
  if(card){
    layers.card??=layer("pf-identity-card-art");
    if(layers.cardId!==cardId){layers.card.innerHTML=card;layers.cardId=cardId;}
    if(layers.card.parentElement!==element)element.prepend(layers.card);
  }else if(layers.card){layers.card.remove();delete layers.card;delete layers.cardId;}

  if(emblem){
    layers.emblem??=layer("pf-identity-badge");
    if(layers.emblemId!==emblemId){layers.emblem.innerHTML=emblem;layers.emblemId=emblemId;}
    const name=element.querySelector<HTMLElement>("[data-identity-name]");
    const target=name??element;
    if(layers.emblem.parentElement!==target)target.prepend(layers.emblem);
    element.classList.toggle("pf-identity-emblem-gutter",!name);
  }else if(layers.emblem){
    layers.emblem.remove();delete layers.emblem;delete layers.emblemId;element.classList.remove("pf-identity-emblem-gutter");
  }
}
