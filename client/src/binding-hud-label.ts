import {bindingSettings} from "./binding-settings";
import {bindingLabel,type BindingAction,type BindingContext,type BindingSettings} from "./input-bindings";

/** Controller labels belong to each input adapter; keyboard/mouse labels always
 * resolve the shared profile. An action without a pad shortcut keeps its usable
 * keyboard/mouse hint, even while the controller is the active input method. */
export function bindingHudLabel(context:BindingContext,action:BindingAction,method:string|undefined,padLabel?:string,settings:BindingSettings=bindingSettings.get()):string{
 return method==="gamepad"&&padLabel?padLabel:bindingLabel(settings,context,action);
}
