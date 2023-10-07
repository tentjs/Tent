import {Praxy, html} from '../dist/praxy';

const App = new Praxy();

const Component = {
  name: 'my-component',
  template: html`
    <div>
      <ul px-for="item in items">
        <li>
          <span>{{item}}</span>
          <button class="remove">remove</button>
        </li>
      </ul>
      <button id="add">Add item</button>
      <button id="reset">Reset list</button>
    </div>
  `,
  data: {
    name: 'Sebastian',
    items: ['one', 'two', 'three'],
  },
};

App.component(Component, ({data, on}) => {
  const initialItems = [...data.items];

  on('click', 'button#add', () => {
    data.items = [...data.items, `four #${data.items.length + 1}`];
  });
  on('click', 'button.remove', ({item}) => {
    data.items = data.items.filter((x) => x !== item);
  });
  on('click', 'button#reset', () => {
    data.items = initialItems;
  });
});
