'use strict';

var P = require('bluebird');
P.longStackTraces();
var Controller2 = require('../lib/Controller');
delete require.cache[require.resolve('../lib/Controller')];
var Controller = require('../lib/Controller');

module.exports = {
        'test prerequisite': function(t)
        {
                t.ok(Controller !== Controller2);
                t.ok(Controller.prototype !== Controller2.prototype);
                t.done();
        },
        'stateMethodName': function(t)
        {
                t.strictEqual( 'fooBar', Controller.stateMethodName('', 'fooBar') );
                t.strictEqual( 'enterFooBar', Controller.stateMethodName('enter', 'fooBar') );
                t.strictEqual( 'enter5', Controller.stateMethodName('enter', 5) );
                t.strictEqual( 'leaveBar', Controller.stateMethodName('leave', {stateName: 'bar', moreStuff: 123}) );
                t.strictEqual( 'enterFooBarBaz', Controller.stateMethodName('enter', 'foo bar baz') );
                t.done();
        },
        'statesEqual': function(t)
        {
                t.ok( Controller.statesEqual('foo', 'foo'));
                t.ok(!Controller.statesEqual('foo', 'bar'));
                t.throws( function(){ Controller.statesEqual({}, {}); }, /must\s+implement.+isStateEqual/i );
                var obj = { isStateEqual: function(other){ return other === 'bar'; } };
                t.ok( Controller.statesEqual(obj, 'bar') );
                t.done();
        },
        'stateListEqual': function(t)
        {
                t.throws( function(){ Controller.stateListEqual('foo', []); }, /Invalid\s+argument/i );
                t.throws( function(){ Controller.stateListEqual([], 'foo'); }, /Invalid\s+argument/i );
                t.ok(Controller.stateListEqual([], []));
                t.ok(!Controller.stateListEqual(['foo'], []));
                t.ok(!Controller.stateListEqual([], ['foo']));
                t.ok(Controller.stateListEqual(['foo'], ['foo']));
                t.ok(Controller.stateListEqual(['foo', 'bar'], ['foo', 'bar']));
                t.ok(!Controller.stateListEqual(['foo', 'bar'], ['foo', 'baz']));
                var arr = ['foo', 'bar'];
                t.ok(Controller.stateListEqual(arr, arr));
                var obj = { isStateEqual: function(other){ return other === 'bar'; } };
                t.ok(Controller.stateListEqual([obj], ['bar']));
                t.done();
        },
        'construct': function(t)
        {
                var controller = new Controller('foo');
                t.strictEqual('foo', controller.context);
                t.strictEqual(null, controller.currentState);
                t.strictEqual(null, controller.child);
                t.strictEqual(null, controller.parent);
                t.done();
        },
        'Dummy': function(t)
        {
                var controller = new Controller.Dummy('foo');
                t.strictEqual('foo', controller.context);
                t.strictEqual(null, controller.currentState);
                t.strictEqual(null, controller.child);
                t.strictEqual(null, controller.parent);
                t.ok(!controller.enter());
                t.ok(!controller.leave());
                t.done();
        },
        'state() invalid arg': function(t)
        {
                var controller = new Controller({abc: 'def'});

                // must always be an array
                controller.state('foo')
                .then(function()
                {
                        t.ok(false);
                })
                .catch(function(err)
                {
                        t.ok(err instanceof Error);
                        t.ok(/Invalid\s+argument/i.test(err.message));
                        t.done();
                });
        },
        'enter state': function(t)
        {
                var controller = new Controller('this is my context');
                var beforeEnters = 0;
                var enters = 0;

                controller.beforeEnter = function(state, upgrade)
                {
                        ++beforeEnters;
                        t.strictEqual(1, beforeEnters);
                        t.strictEqual('foo', state);
                        t.strictEqual(false, upgrade); // false by default
                        t.strictEqual('this is my context', this.context);
                        t.strictEqual(null, this.currentState);

                        return P.resolve('something').bind('try to mess up "this"');
                };

                controller.enterFoo = function(state, upgrade)
                {
                        ++enters;
                        t.strictEqual(1, enters);
                        t.strictEqual('foo', state);
                        t.strictEqual(false, upgrade); // false by default
                        t.strictEqual('this is my context', this.context);
                        t.strictEqual('foo', this.currentState);

                        return P.resolve('something').bind('try to mess up "this"');
                };

                controller.leave = function(state)
                {
                        t.ok(false);
                };

                controller.afterLeave = function(state)
                {
                        t.ok(false);
                };

                controller.state(['foo'])
                .then(function(value)
                {
                        t.strictEqual('foo', controller.currentState);
                        t.strictEqual(null, value);
                        t.strictEqual(this, void 0);

                        return controller.state(['foo']); // this should have no effect
                }).then(function(value)
                {
                        t.strictEqual('foo', controller.currentState);
                        t.strictEqual(null, value);
                        t.strictEqual(this, void 0);
                        t.done();
                });
        },
        'leave state': function(t)
        {
                var controller = new Controller('this is my context');
                var enters = 0;
                var leaves = 0;
                var afterLeaves = 0;

                controller.enterFoo = function(state)
                {
                        ++enters;
                        t.strictEqual(1, enters);
                };

                controller.leaveFoo = function(state)
                {
                        ++leaves;
                        t.strictEqual(1, leaves);
                        t.strictEqual('foo', state);
                        t.strictEqual('this is my context', this.context);
                        t.strictEqual('foo', this.currentState);
                        return P.resolve('something').bind('try to mess up "this"');
                };

                controller.afterLeave = function(state)
                {
                        ++afterLeaves;
                        t.strictEqual(1, afterLeaves);
                        t.strictEqual('foo', state);
                        t.strictEqual('this is my context', this.context);
                        t.strictEqual(null, this.currentState);
                        return P.resolve('something').bind('try to mess up "this"');
                };

                controller.state(['foo'])
                .then(function(value)
                {
                        t.strictEqual('foo', controller.currentState);
                        return controller.state(null);
                })
                .then(function(value)
                {
                        t.strictEqual(null, controller.currentState);
                        t.strictEqual(null, value);
                        t.strictEqual(this, void 0);
                        return controller.state(null); // this should have no effect

                })
                .then(function(value)
                {
                        t.strictEqual(null, controller.currentState);
                        t.strictEqual(null, value);
                        t.strictEqual(this, void 0);
                        t.done();
                });
        },
        'state() during transition': function(t)
        {
                var controller = new Controller('this is my context');

                controller.enterFoo = function(state)
                {
                        return controller.state(['bar']).catch(function(err)
                        {
                                t.ok(err instanceof Error);
                                t.ok(/state\s+transition.+progress/i.test(err.message));
                        });
                };

                controller.enterBar = function(state)
                {
                        t.ok(false);
                };

                controller.state(['foo']).then(function()
                {
                        t.strictEqual('foo', controller.currentState);
                        t.done();
                });
        },
        'missing state enter method': function(t)
        {
                var controller = new Controller('this is my context');

                controller.state(['foo']).catch(function(err)
                {
                        t.ok(err instanceof Error);
                        t.ok(/method.+not.+exist/i.test(err.message));
                        t.strictEqual(null, controller.currentState);
                        t.done();
                });
        },
        'missing state leave method': function(t)
        {
                var controller = new Controller('this is my context');

                controller.enterFoo = function(state)
                {
                };

                // leaveFoo is optional

                controller.state(['foo']).then(function()
                {
                        t.strictEqual('foo', controller.currentState);
                        return controller.state(null);
                })
                .then(function()
                {
                        t.strictEqual(null, controller.currentState);
                        t.done();
                });
        },
        'beforeEnter rejection': function(t)
        {
                var controller = new Controller('this is my context');
                var enters = 0;

                controller.beforeEnter = function(state)
                {
                        ++enters;
                        if (enters === 1)
                        {
                                t.strictEqual('foo', state);
                                t.strictEqual('this is my context', this.context);
                                t.strictEqual(null, this.currentState);
                                throw Error('uh o');
                        }
                        else
                        {
                                t.strictEqual(2, enters);
                                t.strictEqual('foo', state);
                                t.strictEqual('this is my context', this.context);
                                t.strictEqual(null, this.currentState);
                                t.done();
                        }
                };

                controller.enterFoo = function(state)
                {
                        t.strictEqual(2, enters);
                        t.strictEqual('foo', state);
                };

                controller.state(['foo']).catch(function(err)
                {
                        t.ok(err instanceof Error);
                        t.strictEqual('uh o', err.message);
                        t.strictEqual(null, controller.currentState);

                        // try again!
                        return controller.state(['foo']);
                });
        },
        'enter rejection': function(t)
        {
                var controller = new Controller('this is my context');
                var enters = 0;

                controller.enterFoo = function(state)
                {
                        ++enters;
                        if (enters === 1)
                        {
                                t.strictEqual('foo', state);
                                t.strictEqual('this is my context', this.context);
                                t.strictEqual('foo', this.currentState);
                                throw Error('uh o');
                        }
                        else
                        {
                                t.strictEqual(2, enters);
                                t.strictEqual('foo', state);
                                t.strictEqual('this is my context', this.context);
                                t.strictEqual('foo', this.currentState);
                                t.done();
                        }
                };

                controller.state(['foo']).catch(function(err)
                {
                        t.ok(err instanceof Error);
                        t.strictEqual('uh o', err.message);
                        t.strictEqual(null, controller.currentState);

                        // try again!
                        return controller.state(['foo']);
                });
        },
        'leave rejection': function(t)
        {
                var controller = new Controller('this is my context');
                var entersFoo = 0;
                var entersBar = 0;
                var leaves = 0;

                controller.enterFoo = function(state)
                {
                        ++entersFoo;
                        t.strictEqual(1, entersFoo);
                };

                controller.enterBar = function(state)
                {
                        ++entersBar;
                        t.strictEqual(1, entersBar);
                };

                controller.leaveFoo = function(state)
                {
                        ++leaves;

                        t.strictEqual('foo', state);
                        t.strictEqual('this is my context', this.context);
                        t.strictEqual('foo', this.currentState);

                        if (leaves === 1)
                        {
                                throw Error('uh o');
                        }
                        else
                        {
                                t.strictEqual(2, leaves);
                        }
                };


                controller.state(['foo']).then(function()
                {
                        return controller.state(['bar']);

                })
                .catch(function(err)
                {
                        t.ok(err instanceof Error);
                        t.strictEqual('uh o', err.message);
                        t.strictEqual('foo', controller.currentState);

                        // try again!
                        return controller.state(['bar']);
                })
                .then(function()
                {
                        t.strictEqual('bar', controller.currentState);
                        t.done();
                });
        },
        'set child': function(t)
        {
                var myParent = new Controller();
                var mySecondParent = new Controller();
                var myChild = new Controller();
                var otherChild = new Controller2(); // make sure Controllers from other instances of this library work

                t.ok(myParent.child === null);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);

                t.throws(function(){ myChild.child = 'invalid'; }, /Invalid\s+value/i);
                t.throws(function(){ myChild.child = {foo: 123}; }, /Invalid\s+value/i);
                t.ok(myParent.child === null);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);

                myParent.child = myChild;
                t.ok(myParent.child === myChild);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === myParent);

                myParent.child = null;
                t.ok(myParent.child === null);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);

                myParent.child = myChild;
                myParent.child = otherChild;
                t.ok(myParent.child === otherChild);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);
                t.ok(otherChild.child === null);
                t.ok(otherChild.parent === myParent);

                myParent.child = myChild;
                mySecondParent.child = myChild;
                t.ok(myParent.child === null);
                t.ok(myParent.parent === null);
                t.ok(mySecondParent.child === myChild);
                t.ok(mySecondParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === mySecondParent);

                t.done();
        },
        'set parent': function(t)
        {
                var myParent = new Controller();
                var mySecondParent = new Controller();
                var myChild = new Controller();
                var otherChild = new Controller2();

                t.ok(myParent.child === null);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);

                t.throws(function(){ myChild.parent = 'invalid'; }, /Invalid\s+value/i);
                t.throws(function(){ myChild.parent = {foo: 123}; }, /Invalid\s+value/i);
                t.ok(myParent.child === null);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);

                myChild.parent = myParent;
                t.ok(myParent.child === myChild);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === myParent);

                myChild.parent = null;
                t.ok(myParent.child === null);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);

                otherChild.parent = myParent;
                otherChild.parent = mySecondParent;
                t.ok(myParent.child === null);
                t.ok(myParent.parent === null);
                t.ok(mySecondParent.child === otherChild);
                t.ok(mySecondParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);
                t.ok(otherChild.child === null);
                t.ok(otherChild.parent === mySecondParent);

                myChild.parent = myParent;
                otherChild.parent = myParent;
                t.ok(myParent.child === otherChild);
                t.ok(myParent.parent === null);
                t.ok(myChild.child === null);
                t.ok(myChild.parent === null);
                t.ok(otherChild.child === null);
                t.ok(otherChild.parent === myParent);

                t.done();
        },
        'state without child': function(t)
        {
                var myParent = new Controller();
                var enters = 0;

                myParent.enterFoo = function(state, upgrade)
                {
                        ++enters;
                        t.strictEqual(1, enters);
                        t.strictEqual('foo', state);
                        t.strictEqual('foo', this.currentState);
                };

                myParent.state(['foo', 'bar'])
                .catch(function(err)
                {
                        t.ok(err instanceof Error);
                        t.ok(/Attempting.+set.+child.+no.+controller/i.test(err.message));
                        t.strictEqual(null, myParent.currentState);

                        t.done();
                });
        },
        'child without state': function(t)
        {
                var myParent = new Controller();
                var myChild = new Controller();
                var enters = 0;

                myParent.enterFoo = function(state, upgrade)
                {
                        ++enters;
                        t.strictEqual(1, enters);
                        t.strictEqual('foo', state);
                        t.strictEqual('foo', this.currentState);
                        this.child = myChild;
                };

                myParent.state(['foo'])
                .catch(function(err)
                {
                        t.ok(err instanceof Error);
                        t.ok(/Attempting.+set.+state.+child.+missing/i.test(err.message));
                        t.strictEqual(null, myParent.currentState);

                        t.done();
                });
        },
        'child enter': function(t)
        {
                var myParent = new Controller();
                var myChild = new Controller();
                var parentEnters = 0;
                var childEnters = 0;

                myParent.enterFoo = function(state, upgrade)
                {
                        ++parentEnters;
                        t.strictEqual(1, parentEnters);
                        t.strictEqual('foo', state);
                        t.strictEqual('foo', this.currentState);
                        this.child = myChild;
                };

                myChild.enterBar = function(state, upgrade)
                {
                        ++childEnters;
                        t.strictEqual(1, parentEnters); // parent enters before us
                        t.strictEqual(1, childEnters);
                        t.strictEqual('bar', state);
                        t.strictEqual('bar', this.currentState);
                };

                myChild.enterBaz = function(state, upgrade)
                {
                        ++childEnters;
                        t.strictEqual(1, parentEnters); // parent has not been changed
                        t.strictEqual(2, childEnters);
                        t.strictEqual('baz', state);
                        t.strictEqual('baz', this.currentState);
                };

                myParent.state(['foo', 'bar'])
                .then(function()
                {
                        t.strictEqual(1, parentEnters);
                        t.strictEqual(1, childEnters);
                        t.strictEqual('foo', myParent.currentState);
                        t.ok(myParent.child === myChild);
                        t.strictEqual('bar', myParent.child.currentState);

                        return myParent.state(['foo', 'baz']);
                })
                .then(function()
                {
                        t.strictEqual(1, parentEnters);
                        t.strictEqual(2, childEnters);
                        t.strictEqual('foo', myParent.currentState);
                        t.ok(myParent.child === myChild);
                        t.strictEqual('baz', myParent.child.currentState);

                        t.done();
                });

        },
        'child leave': function(t)
        {
                var myParent = new Controller();
                var myChild = new Controller();
                var childEnters = 0;
                var parentLeaves = 0;
                var childLeaves = 0;

                myParent.enterFoo = function(state, upgrade)
                {
                        this.child = myChild;
                };

                myParent.leaveFoo = function(state, upgrade)
                {
                        ++parentLeaves;
                        t.strictEqual(1, parentLeaves);
                        t.strictEqual('foo', state);
                };

                myChild.enterBar = function(state, upgrade)
                {
                        ++childEnters;
                        t.strictEqual(1, childEnters);
                };

                myChild.leaveBar = function(state, upgrade)
                {
                        ++childLeaves;
                        t.strictEqual(0, parentLeaves); // we leave before the parent
                        t.strictEqual(1, childLeaves);
                        t.strictEqual('bar', state);
                        t.strictEqual('bar', this.currentState);
                };

                myChild.afterLeave = function(state)
                {
                        t.strictEqual(0, parentLeaves);
                        t.strictEqual(1, childLeaves);
                        t.strictEqual('bar', state);
                        t.strictEqual(null, this.currentState);
                };

                myParent.enterFoob = function(state, upgrade)
                {
                        this.child = null;
                };

                myParent.state(['foo', 'bar'])
                .then(function()
                {
                        return myParent.state(['foob']);
                })
                .then(function()
                {
                        t.strictEqual(1, parentLeaves);
                        t.strictEqual(1, childLeaves);
                        t.strictEqual('foob', myParent.currentState);
                        t.ok(myParent.child === null);
                        t.strictEqual(null, myChild.currentState);
                        t.done();
                });
        },
        'grandchild transition to no children': function(t)
        {
                var myParent = new Controller(); myParent.dbg = 'myParent';
                var myChild = new Controller(); myChild.dbg = 'myChild';
                var myGrandChild = new Controller(); myGrandChild.dbg = 'myGrandChild';
                var parentEnters = 0;
                var childEnters = 0;
                var grandChildEnters = 0;

                myParent.enterFoo = function(state, upgrade)
                {
                        ++parentEnters;
                        t.strictEqual(1, parentEnters);
                        t.strictEqual('foo', state);
                        t.strictEqual('foo', this.currentState);
                        this.child = myChild;
                };

                myParent.enterQwerty = function(state, upgrade)
                {
                        ++parentEnters;
                        t.strictEqual(2, parentEnters);
                        t.strictEqual('qwerty', state);
                        t.strictEqual('qwerty', this.currentState);
                        this.child = null;
                };

                myChild.enterBar = function(state, upgrade)
                {
                        ++childEnters;
                        t.strictEqual(1, parentEnters);
                        t.strictEqual(1, childEnters);
                        t.strictEqual('bar', state);
                        t.strictEqual('bar', this.currentState);
                        this.child = myGrandChild;
                };

                myGrandChild.enterBaz = function(state, upgrade)
                {
                        ++grandChildEnters;
                        t.strictEqual(1, parentEnters);
                        t.strictEqual(1, childEnters);
                        t.strictEqual(1, grandChildEnters);
                        t.strictEqual('baz', state);
                        t.strictEqual('baz', this.currentState);
                };

                myParent.state(['foo', 'bar', 'baz'])
                .then(function()
                {
                        t.strictEqual(1, parentEnters);
                        t.strictEqual(1, childEnters);
                        t.strictEqual('foo', myParent.currentState);
                        t.ok(myParent.child === myChild);
                        t.strictEqual('bar', myParent.child.currentState);

                        console.info('Switching...');
                        return myParent.state(['qwerty']);
                })
                .then(function()
                {
                        t.strictEqual(2, parentEnters);
                        t.strictEqual(1, childEnters);
                        t.strictEqual(1, grandChildEnters);
                        t.strictEqual('qwerty', myParent.currentState);
                        t.strictEqual(null, myChild.currentState);
                        t.strictEqual(null, myGrandChild.currentState);
                        t.done();
                });

        },
        'getRootController()': function(t)
        {
                var a = new Controller.Dummy();
                var b = new Controller.Dummy();
                var c = new Controller.Dummy();
                var d = new Controller.Dummy();

                a.child = b;
                b.child = c;
                c.child = d;

                t.ok(a.getRootController() === a);
                t.ok(b.getRootController() === a);
                t.ok(c.getRootController() === a);
                t.ok(d.getRootController() === a);

                t.done();
        },
        'getChildrenStateList()': function(t)
        {
                var a = new Controller.Dummy();
                var b = new Controller.Dummy();
                var c = new Controller.Dummy();
                var d = new Controller.Dummy();

                a.child = b;
                b.child = c;
                c.child = d;

                a.state(['a', 'b', 'c', 'd'])
                .then(function()
                {
                        t.deepEqual(['b', 'c', 'd'], a.getChildrenStateList());
                        t.deepEqual([     'c', 'd'], b.getChildrenStateList());
                        t.deepEqual([          'd'], c.getChildrenStateList());
                        t.deepEqual([             ], d.getChildrenStateList());

                        t.done();
                });
        },
        'getParentsStateList()': function(t)
        {
                var a = new Controller.Dummy();
                var b = new Controller.Dummy();
                var c = new Controller.Dummy();
                var d = new Controller.Dummy();

                a.child = b;
                b.child = c;
                c.child = d;

                a.state(['a', 'b', 'c', 'd'])
                        .then(function()
                        {
                                t.deepEqual([             ], a.getParentsStateList());
                                t.deepEqual(['a'          ], b.getParentsStateList());
                                t.deepEqual(['a', 'b'     ], c.getParentsStateList());
                                t.deepEqual(['a', 'b', 'c'], d.getParentsStateList());

                                t.done();
                        });
        },
        'getFullStateList()': function(t)
        {
                var a = new Controller.Dummy();
                var b = new Controller.Dummy();
                var c = new Controller.Dummy();
                var d = new Controller.Dummy();

                a.child = b;
                b.child = c;
                c.child = d;

                a.state(['a', 'b', 'c', 'd'])
                .then(function()
                {
                        t.deepEqual(['a', 'b', 'c', 'd'], a.getFullStateList());
                        t.deepEqual(['a', 'b', 'c', 'd'], b.getFullStateList());
                        t.deepEqual(['a', 'b', 'c', 'd'], c.getFullStateList());
                        t.deepEqual(['a', 'b', 'c', 'd'], d.getFullStateList());

                        t.deepEqual(['X', 'b', 'c', 'd'], a.getFullStateList('X'));
                        t.deepEqual(['a', 'X', 'c', 'd'], b.getFullStateList('X'));
                        t.deepEqual(['a', 'b', 'X', 'd'], c.getFullStateList('X'));
                        t.deepEqual(['a', 'b', 'c', 'X'], d.getFullStateList('X'));

                        t.done();
                });
        }
        // todo upgrade
};