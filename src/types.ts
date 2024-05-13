type ComponentContext<S> = {
  state: S;
  el: HTMLElement | Element;
  attr: <T = string>(name: string) => T | undefined;
};

export type Component<S = {}> = {
  view: (context: ComponentContext<S>) => TentNode;
  state?: S;
  mounted?: (context: ComponentContext<S>) => void;
};

export type TentNode = Node &
  Element &
  HTMLElement & {
    $tent: {
      attributes: object;
      isComponent: boolean;
    };
    children: TentNode[];
  };

export type Children = string | number | TentNode | (Node | string | Context)[];
export type Context = [string, Children | Component, object | undefined];
