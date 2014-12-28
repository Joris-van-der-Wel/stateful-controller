'use strict';

var P = require('bluebird');


/**
 * An object that describes a state. This object must be immutable (by contract).
 * @typedef {Object} ControllerStateObject
 * @property {string} stateName If a state is an object, this property is used to determine
 *           the name of the enter method (see Controller.stateMethodName)
 * @property {function} isStateEqual If a state is an object, this function must be present.
 *           It must return true if the first argument is the same state (even if it is not the same instance)
 */
/**
 * You can use either a string or an immutable object to describe a state.
 * @typedef {(string|ControllerStateObject)} ControllerState
 */
/**
 * @typedef {ControllerState[]} ControllerStateList
 */
/**
 * @typedef {Object} ClientContext
 */

/**
 * The base class for Controllers.
 * Implements the stateful controller pattern. Users can inherit from this class to
 * implement their own stateful controllers. This pattern is useful for implementing
 * single page web applications, as opposed to a more traditional web application following
 * the stateless REST architecture.
 * @param {ClientContext} context
 * @constructor
 */
function Controller(context)
{
        /**
         * @member {ClientContext} context
         * @memberOf Controller
         * @instance
         */
        this.context = context;

        /**
         * @member {ControllerState} currentState
         * @memberOf Controller
         * @instance
         */
        this.currentState = null;

        /**
         * @member {Controller} __child__
         * @memberOf Controller
         * @private
         * @instance
         */
        this.__child__ = null;

        /**
         * @member {Controller} __parent__
         * @memberOf Controller
         * @private
         * @instance
         */
        this.__parent__ = null;

        /**
         * @member {Object} _currentTransition
         * @memberOf Controller
         * @private
         * @instance
         */
        this._currentTransition = null;
}

module.exports = Controller;
Object.defineProperty(Controller.prototype, 'isStatefulController1', { value: true });

/** The current child controller. Setting this attribute also updates the "parent" attribute of the child.
 * @member {Controller} child
 * @memberOf Controller
 * @instance
 */
Object.defineProperty(Controller.prototype, 'child', {
        get: function()
        {
                return this.__child__;
        },
        set: function(value)
        {
                // avoid instanceof
                if (value &&
                    value.isStatefulController1 !== true)
                {
                        throw Error('Invalid value, it must be a Controller or null');
                }

                if (this.__child__)
                {
                        this.__child__.__parent__ = null;
                }

                if (value)
                {
                        if (value.__parent__)
                        {
                                value.__parent__.child = null;
                        }

                        value.__parent__ = this;
                }

                this.__child__ = value;
        }
});

/** The current parent controller. Setting this attribute also updates the "child" attribute of the parent.
 * @member {Controller} parent
 * @memberOf Controller
 * @instance
 */
Object.defineProperty(Controller.prototype, 'parent', {
        get: function()
        {
                return this.__parent__;
        },
        set: function(value)
        {
                if (value &&
                    value.isStatefulController1 !== true)
                {
                        throw Error('Invalid value, it must be a Controller or null');
                }

                if (this.__parent__)
                {
                        this.__parent__.__child__ = null;
                }

                if (value)
                {
                        if (value.__child__)
                        {
                                value.__child__.__parent__ = null;
                        }
                        value.__child__ = this;
                }

                this.__parent__ = value;
        }
});

/**
 * @example Controller.stateMethodName('enter', 'foo') // 'enterFoo'
 * @example Controller.stateMethodName('enter', {abc: 5, stateName: 'enterFoo', ...} // 'enterFoo'
 * @param {string} prefix
 * @param {ControllerState} state
 * @returns {string}
 */
Controller.stateMethodName = function(prefix, state)
{
        if (typeof state === 'object' &&
            'stateName' in state)
        {
                state = state.stateName;
        }

        state = state.toString();

        var parts = state.split(/\s+/);

        for (var i = prefix ? 0 : 1;
             i < parts.length;
             ++i)
        {
                parts[i] = parts[i][0].toUpperCase() +
                           parts[i].slice(1);
        }

        if (!prefix)
        {
                return state;
        }

        return prefix + parts.join('');
};

/**
 * Are two states equal?.
 * If both states are a string, case sensitive string matching is used.
 * If stateA is an object, return <code>stateA.isStateEqual(stateB)</code>
 * @param {ControllerState} stateA
 * @param {ControllerState} stateB
 * @returns {boolean}
 */
Controller.statesEqual = function(stateA, stateB)
{
        if (stateA &&
            stateB &&
            typeof stateA === 'object')
        {
                if (!stateA.isStateEqual)
                {
                        throw Error('If a state is an object, it must implement a isStateEqual(other) method');
                }

                return stateA.isStateEqual(stateB);
        }

        return stateA === stateB;
};

/**
 * Are two states lists equal?.
 * Each state is matched using Controller.statesEqual
 * @param {ControllerStateList} statesA
 * @param {ControllerStateList} statesB
 * @returns {boolean}
 */
Controller.stateListEqual = function(statesA, statesB)
{
        if (!Array.isArray(statesA) ||
            !Array.isArray(statesB))
        {
                throw Error('Invalid arguments');
        }

        if (statesA === statesB)
        {
                return true;
        }

        if (statesA.length !== statesB.length)
        {
                return false;
        }

        for (var i = 0; i < statesA.length; ++i)
        {
                if (!Controller.statesEqual(statesA[i], statesB[i]))
                {
                        return false;
                }
        }

        return true;
};

Controller.prototype._transitionChildLeave = P.method(function _transitionChildLeave()
{
        var t = this._currentTransition;

        if (this.child)
        {
                return this.child.state(null, t.upgrade);
        }

        return null;
});

Controller.prototype._transitionMyLeave = P.method(function _transitionMyLeave()
{
        var t = this._currentTransition;

        if (t.myPreviousState)
        {
                try
                {
                        var p = this.leave(t.myPreviousState);

                        if (p)
                        {
                                return p.bind(this).finally(this._transitionMyLeaveFinally);
                        }
                }
                finally
                {
                        this._transitionMyLeaveFinally();
                }
        }

        return null;
});

Controller.prototype._transitionMyLeaveFinally = P.method(function _transitionMyLeaveFinally()
{
        this.currentState = null;
        this.child = null;
});

Controller.prototype._transitionMyAfterLeave = P.method(function _transitionMyAfterLeave()
{
        var t = this._currentTransition;

        if (t.myPreviousState)
        {
                return this.afterLeave(t.myPreviousState);
        }

        return null;
});

Controller.prototype._transitionMyBeforeEnter = P.method(function _transitionMyBeforeEnter()
{
        var t = this._currentTransition;

        if (t.myState)
        {
                return this.beforeEnter(t.myState, t.upgrade);
        }

        return null;
});

Controller.prototype._transitionMyEnter = P.method(function _transitionMyEnter()
{
        var t = this._currentTransition;

        if (t.myState)
        {
                this.currentState = t.myState;
                return this.enter(t.myState, t.upgrade);
        }

        return null;
});

Controller.prototype._transitionChildState = P.method(function _transitionChildState()
{
        var t = this._currentTransition;

        if (t.childState !== void 123)
        {
                if (!this.child)
                {
                        throw Error('Attempting to set child state "'
                                    + t.childState
                                    + '", but no child controller has been set by the state "'
                                    + t.myState
                                    + '".'
                        );
                }

                return this.child.state(t.childStateChain, t.upgrade);
        }
        else
        {
                if (t.myState && this.child)
                {
                        throw Error('Attempting to set state "'
                                    + t.myState
                                    + '", but a child state is missing (a child controller has been set)'
                        );
                }
        }

        return null;
});

Controller.prototype._transitionCatch = P.method(function _transitionCatch(err)
{
        // something went wrong, assume we are still in the previous state
        var t = this._currentTransition;
        this.currentState = t.myPreviousState;
        return P.reject(err);
});

Controller.prototype._transitionFinally = P.method(function _transitionFinally()
{
        this._currentTransition = null;
});

/**
 * Assign a chain of states to this controller and its children.
 * Each controller has 0 or 1 child controllers. When a controller enters a state, it might create a child controller
 * for that state (by setting the child attribute on its controller).
 * That child controller is also assigned a state by this method (the next one in the chain).
 *
 * @example
 * myController.state(['pages', 'contact', 'foo']); // myController is set to the state 'pages',
 *                                                  // its child controller is set to 'contact', and so on.
 * @param {?ControllerStateList} states The state chain, or null to leave the state without setting a new one.
 * @param {boolean} [upgrade=false]
 *        <p>If true, the "results" of the given "state" is already present in some form.
 *           These "results" were generated by a previous state transition in a different execution context. If this
 *           parameter is "true" you will have to parse the existing "results" and set up any variables, attributes, event
 *           listeners, etc, so that your controller matches the one in the different execution context.
 *        </p>
 *        <p>After this "upgrade", non-upgrade state transitions are able to occur. This means your
 *           "leave" methods must be able to modify these existing "results" so that the state transition is able to execute
 *           properly.
 *        </p>
 *
 *        <p>The most common use case for upgrades is in a client-server web application. An example:</p>
 *
 *        <ol>
 *                <li>The client performs a GET request to "/foo"</li>
 *                <li>The client & server translate "/foo" to the state ['contentPage', 'foo']</li>
 *                <li>The server creates a ClientContext including a new DOM Document</li>
 *                <li>The server creates a: new FrontController(clientContext)</li>
 *                <li>The server executes frontController.state(['contentPage', 'foo'], false)</li>
 *                <li>The server serializes the DOM Document as html and sends it to the client as a HTTP response</li>
 *                <li>The client creates a ClientContext including the DOM Document of the html it received</li>
 *                <li>The client creates a: new FrontController(clientContext)</li>
 *                <li>The client executes frontController.state(['contentPage', 'foo'], true)</li>
 *                <li>The client is now able to execute other state transitions.<br>
 *                    e.g. frontController.state(['contentPage', 'bar'], false)
 *                </li>
 *        </ol>
 * @return {!Promise}
 */
Controller.prototype.state = P.method(function state(states, upgrade)
{
        if (states === null)
        {
                states = [null];
        }

        if (!Array.isArray(states))
        {
                throw Error('Invalid argument, "states" must be an array');
        }

        if (this._currentTransition)
        {
                throw Error('A previous state transition is still in progress');
        }

        this._currentTransition = {
                myPreviousState: this.currentState,
                myState: states[0],
                childState: states[1],
                childStateChain: states.slice(1),
                upgrade: !!upgrade
        };

        if (Controller.statesEqual(this.currentState, this._currentTransition.myState))
        {
                return P.bind(this)
                        .then(this._transitionChildState)
                        .bind(this)
                        .finally(this._transitionFinally)
                        .bind()
                        .return(null);
        }
        else
        {
                return P.bind(this).then(this._transitionChildLeave)
                        .bind(this).then(this._transitionMyLeave)
                        .bind(this).then(this._transitionMyAfterLeave)
                        .bind(this).then(this._transitionMyBeforeEnter)
                        .bind(this).then(this._transitionMyEnter)
                        .bind(this).then(this._transitionChildState)
                        .bind(this).catch(this._transitionCatch)
                        .bind(this).finally(this._transitionFinally)
                        .bind()
                        .return(null);
        }
});

/**
 * This method is invoked by .state(...) when the state for this controller should change (leave() is called first).
 * The default implementation translates the state to a method invocation.
 * e.g. "foo" -> this.enterFoo()
 * Override this method if you want to do something else (like pulling the states
 * out of a database);
 * @param {ControllerState} state string or an object that describes your state. toString() is called on the object to
 *        determine the method name to use. {abc: 5, toString: function(){ return 'foo';}, ...} -> this.enterFoo()
 * @param {boolean} [upgrade=false] Upgrading the results of a state transition in a different execution context? See the
 *        state() method for more documentation.
 * @throws {Error} If the state method does not exist.
 * @return {?Promise}
 * @protected
 */
Controller.prototype.enter = function enter$default(state, upgrade)
{
        var method;
        this.currentState = state;

        method = Controller.stateMethodName('enter', state);
        if (typeof this[method] !== 'function')
        {
                throw Error('State method ' + method + ' does not exist');
        }

        return this[method](state, !!upgrade);
};

Controller.prototype.beforeEnter = function beforeEnter$default(state, upgrade) { };

/**
 * This method is invoked by .state(...) when the current state is being left.
 * The default implementation translates the state to a method invocation.
 * e.g. "foo" -> this.leaveFoo();
 * Unlike enter(), this method does not throw if this method does not exist.
 * @protected
 * @return {?Promise}
 */
Controller.prototype.leave = function leave$default(state)
{
        var method;

        method = Controller.stateMethodName('leave', state);

        if (typeof this[method] === 'function')
        {
                return this[method](state);
        }

        return null;
};

Controller.prototype.afterLeave = function afterLeave$default(state, upgrade) { };

/**
 * Find the top most Controller by iterating over .parent and return it
 * @returns {Controller}
 */
Controller.prototype.getRootController = function()
{
        var cont = this;
        while (cont.parent)
        {
                cont = cont.parent;
        }

        return cont;
};

/**
 * Return the states all our (grand)children.
 * Our own child be at index 0, the child of our child at index 1, etc
 * @returns {ControllerStateList}
 */
Controller.prototype.getChildrenStateList = function()
{
        var states = [];
        var cont = this.child;

        while (cont)
        {
                states.push(cont.currentState);
                cont = cont.child;
        }

        return states;
};

/**
 * Return the states of all the (grand)parents of this controller.
 * The top most parent will be at index 0, our own parent at the last index
 * @returns {ControllerStateList}
 */
Controller.prototype.getParentsStateList = function()
{
        var states = [];
        var cont = this.parent;

        while (cont)
        {
                states.unshift(cont.currentState);
                cont = cont.parent;
        }

        return states;
};

/**
 * Return the full state list this controller is part of.
 * This is identical to calling getRootController().getChildrenStateList()
 * @param {ControllerState} [replacementState=this.currentState] If set, replace our own state with this state in the returned list
 * @returns {ControllerStateList}
 */
Controller.prototype.getFullStateList = function(replacementState)
{
        var states = this.getParentsStateList();
        states.push(replacementState === void 3.14159 ? this.currentState : replacementState);
        states = states.concat(this.getChildrenStateList());
        return states;
};

// So that you can use: require('stateful-controller').Controller
Controller.Controller = Controller;
Controller.Dummy = require('./DummyController');