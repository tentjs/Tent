# Praxy

Build web apps with atomic components.

## Usage

```js
import { Praxy, html } from 'praxy';

const App = new Praxy();

const Component = {
  // This is the template of your component. Here you define what should be rendered into the DOM.
  // Note: You may notice by inspecting the DOM that some elements will have `k` and `i` attributes. These are used
  // internally by Praxy to various operations, such as determine if anything should re-render.
  template: html`
    <div>
      <div>
        <p>My name is {{name}}.</p>
      </div>
      <div>
        <p>This is my to-do</p>
        <!--
        This is a for loop. It will loop each item in an array, and make it accessible via {{}}
        Note: You shouldn't add a key attribute. It will be added automatically - it's called i (for index).
        -->
        <ul px-for="todo in todos">
          <li>
            {{todo.title}} ({{todo.done ? 'Done' : 'To-do'}}) 
            <button class="remove">Remove</button>
            <button class="done">Done</button>
          </li>
        </ul>
      </div>
      <div>
        <input name="newTodo" type="text" />
        <button id="add">Add</button>
      </div>
    </div>
  `,
  // This is the data of your component. It will react to changes.
  // It will however only listen for changes on the root properties of the object.
  // Meaning that to update a nested object, or an array, you do:
  // add to array: data.todos = [...data.todos, 'new']
  // add to an object: data.obj = {...data.obj, another: 'cool value'}
  data: {
    name: 'Sebastian',
    age: 30,
    newTodo: '',
    todos: [
      {title: 'Drink coffee', done: false},
      {title: 'Walk the dog', done: true},
      {title: 'Go to work', done: false},
    ],
    obj: { value: 'someValue' },
  },
};

App.component(
  Component,
  // This is the "mounted" lifecycle - if you will.
  // Here you write the logic of your component.
  ({data, on} => {
    // This is how you add event listeners to elements within the component.
    on('input', '[name="newTodo"]',
      ({target}) => data.newTodo = target.value
    );
    on('click', 'button#add',
      () => data.todos = [...data.todos, {title: data.newTodo, done: false}]
    );
    // All event listeners within a px-for loop will be given a `item`,
    // which is the current item in the loop.
    on('click', 'button.remove',
      ({target, item}) => data.todos = data.todos.filter((x) => x !== item)
    );
    on('click', 'button.done', ({item}) => {
      const items = [...data.todos];
      const x = items.find((x) => x.title === item.title);
      x.done = !x.done;
      data.todos = items;
    });
  }
);
```

