var vm = require('vm');
var util = require('util');
var fs = require('fs');
var path = require('path');
module.exports = BaseController;

/**
 * Base class for any controller. It describes common API for controllers.
 *
 * Each instance method could be triggered from controller context (when
 * run in new context). Basically this class describes context, which contains
 * description of controller. This looks pretty tricky, but it helps to write
 * clean and easy to read controller classes without thinking about OOP (in case
 * of running in new context). Alternatively you can use this class as parent
 * for any other class.
 *
 * Example 1. OOP-style
 *
 *     function MyController() {
 *         BaseController.call(this);
 *     }
 *     MyController.prototype.__proto__ = BaseController.prototype;
 *     var ctl = new MyController;
 *     ctl.action('index', function index() {
 *         this.locals.items = [];
 *         this.render();
 *     });
 *     ctl.call('name');
 *
 * Example 2. Functional style
 *
 *     action(function index() {
 *         this.items = [];
 *         render();
 *     });
 *
 */
function BaseController() {
    var ctl = this;

    this.controllerName = this.constructor.controllerName;

    // just declare context things here
    this.context = {
        req: null,
        res: null,
        actionName: null
    };

    ['req', 'res', 'actionName'].forEach(function (key) {
        ctl.__defineGetter__(key, contextGetter(ctl, key));
    });

    ['params', 'session', 'body'].forEach(function (key) {
        ctl.__defineGetter__(key, contextGetter(ctl, 'req', key));
    });

    function contextGetter(ctl, key, subkey) {
        return subkey ?
            function () { return ctl.context[key][subkey]; }:
            function () { return ctl.context[key]; };
    }

    Object.keys(BaseController.extensions).forEach(function (k) {
        ctl[k] = BaseController.extensions[k];
    });

}

BaseController.route = function (action) {
    var Controller = arguments.callee.caller;
    return function route(req, res, next) {
        (new Controller).perform(action, req, res, next);
    };
};

BaseController.prototype.next = function (err) {
    if (err) {
        this.context.outerNext(err);
    } else {
        this.context.innerNext();
    }
};

BaseController.extensions = {};

var cache = {};

BaseController.constructClass = function (controllerName) {
    Controller.controllerName = controllerName || 'Controller';
    function Controller() {
        if (!(this instanceof Controller)) {
            return BaseController.route(arguments[0]);
        }

        BaseController.call(this);
    }
    Controller.prototype.__proto__ = BaseController.prototype;
    BaseController.prototype.reset.apply({constructor: Controller});
    // util.inherits(Controller, BaseController);
    return Controller;
};

BaseController.prototype.reset = function () {
    this.constructor.actions = {};
    this.constructor.before = [];
    this.constructor.after = [];
};

BaseController.prototype.build = function (script) {
    var ctl = this;
    try {
        vm.createScript(script).runInNewContext(context(this));
    } catch (e) {
        // TODO for node 0.9.3: catch line number
        throw e;
    }

};

function context(x) {

    fix(x.constructor.prototype.__proto__);
    fix(x.constructor.prototype);

    return x;

    function fix(source) {
        Object.getOwnPropertyNames(source).forEach(function (k) {
            if (k !== 'constructor') {
                x[k] = source[k].bind(x);
            }
        });
    }
};

/**
 * @override default controller string representation
 */
BaseController.prototype.toString = function toString() {
    return 'Controller ' + this.controllerName;
};

extendWith('rendering');
extendWith('flow-control');
extendWith('helpers');
extendWith('code-sharing');

function extendWith(what) {
    var bc = require('./' + what);
    Object.keys(bc.prototype).forEach(function (meth) {
        BaseController.prototype[meth] = bc.prototype[meth];
    });
}
