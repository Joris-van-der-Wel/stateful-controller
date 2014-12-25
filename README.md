stateful-controller
===================
This module provides a `Controller` class that implements the stateful controller pattern. Users can inherit from this class to implement their own stateful controllers. This pattern is useful for implementing single page web applications, as opposed to a more traditional web application following the stateless REST architecture.

1. [Installing](#installing)
2. [Tutorial](#tutorial)
  1. [Simple states](#simple-states)
  2. [ClientContext object](#clientcontext-object)
  3. [Child states](#child-states)
  4. [Generic state methods](#generic-state-methods)
  5. [State objects](#state-objects)
  6. [Upgrading](#upgrading)
3. [API Reference](api.md)

Installing
----------
```shell
npm install stateful-controller inherits --save
```

Tutorial
--------
Each stateful `Controller` has at most one state active at a time. A state is implemented by adding an `enter` method to your class. You should also implement a `leave` method to clean up any changes your state has made:

### Simple states
```javascript
var Controller = require('stateful-controller');

function MyController()
{
        Controller.call(this);
        this.fooStuff = null;
}

module.exports = MyController;
require('inherits')(MyController, Controller);

// Implements the 'foo' state
MyController.prototype.enterFoo = function(state)
{
        this.fooStuff = document.createElement('p');
        this.fooStuff.textContent = 'We just entered the '+state+' state!';
        document.body.appendChild(this.fooStuff);
};

MyController.prototype.leaveFoo = function(state)
{
        document.body.removeChild(this.fooStuff);
        this.fooStuff = null;
};
```

To enter the `foo` state:

```javascript
var myController = new MyController();
myController.state(['foo']);
```

To leave the `foo` state:

```javascript
myController.state(null);
// or:
myController.state(['a different state']);
````

### Asynchronous
If you return a Promise in your enter or leave method, this library will wait for your promise to resolve before going to the next step. This library uses [bluebird](https://www.npmjs.com/package/bluebird).

``` javascript
var P = require('bluebird');

MyController.prototype.enterFoo = function(state)
{
    // Wait 1 second
    return P.delay(1000);
};

MyController.prototype.leaveFoo = function(state)
{
    return P.delay(1000);
};
```

```javascript
var myController = new MyController();
myController.state(['foo']).then(function()
{
    // Entering state 'foo' will take a second...
    console.log('done!');
});
```

### ClientContext object
The constructor of Controller takes an optional `ClientContext` argument:

```javascript
function MyController(context)
{
        Controller.call(this, context);
}
```

This object should be used to pass any data your controllers might need. For example an URL router, a database driver or data about the user.

```javascript
var myClientContext = {
    database: myDatabase,
    user: {
        _id: 1234,
        name: 'Joris',
        sessionToken: '1234ab'
    }
};
var myController = new MyController(myClientContext);
```

You can use the `context` attribute to retrieve it in your state methods:

```javascript
MyController.prototype.enterFoo = function(state)
{
    var db = this.context.database;

    return db.pageText.findOneAsync('foo', function(text)
    {
        this.fooStuff = document.createElement('p');
        this.fooStuff.textContent = text;
        document.body.appendChild(this.fooStuff);
    });
};
```

### Child states
Each `Controller` can be assigned a child controller. This lets you chain different controllers, when calling the `state` method you need to provide a valid state for each controller.
 
```javascript
MyController.prototype.enterContentPage = function(state)
{
    // This is the same for all my content pages:
    this.header = document.createElement('header');
    this.header.textContent = 'This is my website!';
    document.body.appendChild(this.header);
    
    this.pageContent = document.createElement('div');
    document.body.appendChild(this.pageContent);

    this.footer = document.createElement('footer');
    this.footer.textContent = 'Copyright 2038 Mr. Public Domain';
    document.body.appendChild(this.footer);

    // Set up my child controller by assigning it to the special attribute "child"
    this.child = new MyPagesController(this.context, this.pageContent);
};

MyController.prototype.leaveContentPage = function(state)
{
    document.body.removeChild(this.header);
    document.body.removeChild(this.pageContent);
    document.body.removeChild(this.footer);
    this.header = null;
    this.pageContent = null;
    this.footer = null;

    this.child = null;
};
```

```javascript
var Controller = require('stateful-controller');

function MyPagesController(context, contentContainer)
{
    Controller.call(this, context);
    this.contentContainer = contentContainer;
    this.content = null;
}

module.exports = MyPagesController;
require('inherits')(MyPagesController, Controller);

MyPagesController.prototype.enterHome = function(state)
{
    this.content = document.createElement('p');
    this.content.textContent = 'You are now on the home page!';
    this.contentContainer.appendChild(this.content);
};

MyPagesController.prototype.leaveHome = function(state)
{
    this.contentContainer.removeChild(this.content);
    this.content = null;
};

MyPagesController.prototype.enterContact = function(state)
{
    this.content = document.createElement('div');
    this.content.textContent = 'You can contact me here: ...';
    this.contentContainer.appendChild(this.content);
};

MyPagesController.prototype.leaveContact = function(state)
{
    this.contentContainer.removeChild(this.content);
    this.content = null;
};

```

You need to provide a valid state for each controller:

```javascript
var myController = new MyController(myContext);
myController.state(['contentPage', 'home'])
.then(function()
{
    return myController.state(['contentPage', 'contact']);
});

// This example runs the following methods:
// 1. enterContentPage
// 2. enterHome
// 3. leaveHome
// 4. enterContact
```

This prevents code duplication and makes sure you only change what needs to be changed. Handy if you would like to play animations without playing them for what is already on screen. Or if you would like to avoid making the same database queries over and over.

### Generic state methods
The `enterFoo()` and `leaveFoo()` methods are called by the default `enter()` and `leave()` methods. You can override these if you would like:

```javascript
MyController.prototype.enter = function(state)
{
    this.stuff = document.createElement('p');
    document.body.appendChild(this.stuff);

    if (state === 'foo')
    {
        this.stuff.textContent = 'Some foo stuff';
    }
    else if (state === 'bar')
    {
        this.stuff.textContent = 'Some bar stuff';
    }
    else
    {
        throw Error('Invalid state ' + state);
    }
};

MyController.prototype.leave = function(state)
{
    document.body.removeChild(this.stuff);
    this.stuff = null;
};
```

You can also implement the `beforeEnter()` and `afterLeave()` methods which are called before `enter()` is called and after `leave()` is called.

### State objects
Instead of strings, it is also possible to use objects to describe a state. State objects need to follow a couple of rules:

1. You __must not__ modify these objects after you have passed them to a `Controller`. They should be immutable
2. You __must__ implement a method to compare the equality of two objects. Assign this function to the attribute `isStateEqual` on your object. Example: `x.isStateEqual(y)`. This equality check should be [reflexive, symmetric, transitive and consistent](http://docs.oracle.com/javase/7/docs/api/java/lang/Object.html#equals%28java.lang.Object%29). This library will never pass a `null` value to this method.
3. You _may_ give the object a state name which will be used for the enter and leave methods. Use the attribute `stateName` on your object.

```javascript
var equal = require('deep-equal'); // npm install deep-equal --save

function SearchFilterState(filters)
{
    this.stateName = 'searchFilter'; // enterSearchFilter and leaveSearchFilter
    this.filters = filters;
}

SearchFilterState.prototype.isStateEqual = function(other)
{
    return this.stateName === other.stateName &&
           equal(this.filters, other.filters);
};
```

```javascript
var filterState = new SearchFilterState({
    query: 'The answer to life the universe and everything',
    language: 'nl',
    safeSearch: false
});

return myController.state(['contentPage', 'search', filterState]);
```

### Upgrading
Conceptually, there are two ways a certain state can be attained:

1. The contents of a state are not present and have to be created
2. The contents of a state have been previously generated in a different execution context. This means the contents are already present but have not been identified as a specific state

All of the examples so far are of the first type, the content is created in the `enter` methods. In some cases you need to handle the second type. In this library, the second type is called "upgrading".

A good example of upgrading is in a client-server web application. The server sets up a specific state and sends the content (html) to the browsers. The browser then needs to _upgrade_ that content so that it knows what state it is currently in. This means all the Controllers have their state properly set based on the content received from the server. This includes things such as setting up local variables needed to leave the state and registering of events such as user input. The scripts running in browser then have enough knowledge to enter a different state, without going back to the server.

You can mark a state transition as an "upgrade" by setting the second argument to the `state()` method to true. This argument is passed to any `enter()` method.

Here is an example:

 1. The client performs a GET request to "/foo"
 2. The client & server translate "/foo" to the state `['contentPage', 'foo']`
 3. The server creates a new `ClientContext` including a new DOM `Document`
 4. The server creates a: `new FrontController(clientContext)`
 5. The server executes `frontController.state(['contentPage', 'foo'], false)`
 6. The server serializes the DOM Document as html and sends it to the client as a HTTP response
 7. The client creates a `ClientContext` using the DOM `Document` of the html it received (e.g. `window.document`)
 8. The client creates a: `new FrontController(clientContext)`
 9. The client executes `frontController.state(['contentPage', 'foo'], true)`
10. The client is now able to execute other state transitions.
    e.g. `frontController.state(['contentPage', 'bar'], false)`

```javascript
FrontController.prototype.enterContentPage = function(state, upgrade)
{
    if (upgrade)
    {
        this.header = document.getElementById('contentPageHeader');
        this.pageContent = document.getElementById('contentPage');
        this.footer = document.getElementById('contentPageFooter');
    }
    else
    {
        this.header = document.createElement('header');
        this.header.id = 'contentPageHeader';
        this.header.textContent = 'This is my website!';
        document.body.appendChild(this.header);

        this.pageContent = document.createElement('div');
        this.pageContent.id = 'contentPage';
        document.body.appendChild(this.pageContent);

        this.footer = document.createElement('footer');
        this.footer.id = 'contentPageFooter';
        this.footer.textContent = 'Copyright 2038 Mr. Public Domain';
        document.body.appendChild(this.footer);
    }

    this.child = new MyPagesController(this.context, this.pageContent);
};

FrontController.prototype.leaveContentPage = function(state)
{
    document.body.removeChild(this.header);
    document.body.removeChild(this.pageContent);
    document.body.removeChild(this.footer);
    this.header = null;
    this.pageContent = null;
    this.footer = null;

    this.child = null;
};
```


API Reference
=============
You can find a description of the API in the file [api.md](api.md)
