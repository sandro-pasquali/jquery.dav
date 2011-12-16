/*
* jDav JQuery plugin v1.0
*
* Copyright 2008 Lime Labs LLC
*
* @author Sandro Pasquali (spasquali@gmail.com)
*
* jDav is free software: you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License
* version 3 as published by the Free Software Foundation.
*
* jDav is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public
* License along with jDav.  If not, see <http://www.gnu.org/licenses/>.
*/


(function($) {

  /**
   * The DAV methods you want to provide support for.
   * 
   * @see #methodSupported
   */
  var supportedMethods = { 
    GET:                1,
    POST:               1,
    HEAD:               2,
    PUT:                2,
    DELETE:             2,
    PROPFIND:           3,
    PROPPATCH:          3,
    MKCOL:              3,
    LOCK:               3,
    UNLOCK:             3,
    COPY:               3,
    MOVE:               3,
    REPORT:             3,
    SEARCH:             3,
    CHECKIN:            3,
    CHECKOUT:           3,
    UNCHECKOUT:         3,
    'VERSION-CONTROL':  3,      
    TRACE:              3,
    BIND:               3,
    UNBIND:             3,
    REBIND:             3,
    MKREDIRECTREF:      3,
    OPTIONS:            3                                
  };
  
  /**
   * Locking default settings.
   *
   * @see     #lock
   */
  var defaultLockScope    = 'exclusive';
  var defaultLockType     = 'write';
  var defaultLockTimeout  = 86400;
  var defaultLockDepth    = 'infinity';
  
  /**
   * User home directory.
   *
   * @see     #lock
   */
  var userHomeDir         = '/home/';
  
  /**
   * Xml header, used variously when making calls.
   */
  var XmlHeader           = '<?xml version="1.0" encoding="utf-8" ?>';
    
  /**
   * This is unfortunate, but I don't want to use the jquery browser detection
   * functions, as they are deprecated, and I don't know of a non-sniffing
   * way to determine whether or not this or that browser supports a given
   * method.  One dismissed consideration was to just support GET and POST,
   * and have *all* other methods use the POST?webdav-method construct, obviating
   * the need to check browser type.  If you would like to go that route, it
   * isn't hard to refactor into the POST?webdav-method construct.  NOTE: that this
   * POST behaviour is *exclusive* to the LimeBits implementation, via Hammock.
   */
  var uA =        window.navigator.userAgent.toLowerCase();
  var isSafari =  /webkit/.test(uA);
  var isOpera =   /opera/.test(uA);
  var isIE =      /msie/.test(uA) && !/opera/.test(uA);
  var isMoz =     /mozilla/.test(uA) && !/(compatible|webkit)/.test(uA);
  var isGecko =   /Gecko/.test(uA) && (/KHTML/.test(uA) === false); 
    
  /**
   * Utility functions
   */

  var isObject = function(ob) {
    return !!ob && Object.prototype.toString.call(ob) === '[object Object]';  
  };
  
  var isArray  = function(ob) {
    return  !!ob && Object.prototype.toString.apply(ob) === '[object Array]';
  };
  
  var isString = function(ob) {
    return !!ob && Object.prototype.toString.apply(ob) === '[object String]';
  };
  
  /**
   * Prior to making a call, check if the requested method is supported
   * by the current browser.
   *
   * @see #supportedMethods
   */                              
  var methodSupported = function(meth) {
    var sm = supportedMethods[meth];
    if(sm) {    
      if(sm < 2)              return true;
      if(isOpera && (sm < 3)) return true;
      if(isIE && (sm < 4))    return true;
      if(isMoz || isGecko)    return true;
    }
    return false;
  };
    
  /**
   * jQuery#ajax option #beforeSend may be set to a function reference,
   * and this function will fire prior to the request being sent.  It is
   * passed the Xhr object, so this is the point you will want to do
   * things like set headers, for example.
   *
   * @see #propFind
   * @url http://docs.jquery.com/Ajax/jQuery.ajax#options
   */
  var extendBeforeSend = function(cob, f) {
    var bs = cob.beforeSend || function(){};
    
    cob.beforeSend = function(xhr) {
      bs(xhr);
      f(xhr);
    };    
  }
  
  /***************************************
   * 
   * BEGIN #Dav extension
   *
   ***************************************/


  $.fn.extend($,{   
    
    /**
     * The 'setup' method, which establishes the resource to be
     * operated on.  
     * 
     * @param     {Mixed}     res    A resource Url string, or a DOM Collection.
     * @returns                      A Dav Api.
     * @type      {Object}
     */
    Dav: function(res) {
      
      /**
       * Stores the last request object.
       */
      var lastRequest = {};
      
      /**
       * Stores the last requested resourceUrl.
       *
       * @see     #prepare
       */
      var resourceUrl;
      
      /**
       * Stores the last Dom Node.
       */
      var resource;
      
      /**
       * Stores last node searched for.
       *
       * @see     #getNodesByTag
       * @see     #seekToNode
       * @see     #eachNode
       */
      var lastNodeMatch   = isArray(res) ? res : [res];
      
      if(isString(res)) {
        resourceUrl     = res;
        resource        = {};
      }
      else {
        resource          = res;
        resourceUrl       = lastRequest.hasOwnProperty('url')
                            ? lastRequest.url
                            : '/';
      }

      var api = function() {

        /***************************************
         *
         * Core Dav Methods
         *
         ***************************************/
         
        /**
         * GET
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @url     http://www.webdav.org/specs/rfc2518.html#rfc.section.8.4
         */
        this.get = function(cob) {
          this.prepare(cob, 'GET');
          return this.send(cob); 
        };
  
        /**
         * POST
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @url     http://www.webdav.org/specs/rfc2518.html#rfc.section.8.4
         */
        this.post = function(cob) {
          this.prepare(cob, 'POST');
          return this.send(cob); 
        };
        
        /**
         * HEAD
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @url     http://www.webdav.org/specs/rfc2518.html#rfc.section.8.4
         */
        this.head = function(cob) {
          this.prepare(cob, 'HEAD');
          return this.send(cob); 
        };
        
        /**
         * MKCOL
         * Make a collection (folder).
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href    http://greenbytes.de/tech/webdav/rfc4918.html#METHOD_MKCOL
         * @see     #createFolder
         */
        this.mkcol = function(cob) {
          this.prepare(cob, 'MKCOL');
          return this.send(cob);  
        };
        
        /**
         * Puts a file (writes the content of the sent .body to a url)
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href    http://greenbytes.de/tech/webdav/rfc4918.html#METHOD_PUT
         * @see     #createFile
         */
        this.put = function(cob) {
          this.prepare(cob, 'PUT');
          return this.send(cob); 
        };
        
        /**
         * DELETE 
         * Deletes a resource based on sent url.
         * NOTE: using `remove` as `delete` is a protected JS word, and I don't
         * want to uppercase method names just for this one.
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href    http://greenbytes.de/tech/webdav/rfc4918.html#METHOD_DELETE
         */
        this.remove = function(cob) {
          this.prepare(cob, 'DELETE');
          return this.send(cob);   
        };
        
        /**
         * REPORT
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href    http://greenbytes.de/tech/webdav/rfc3253.html#METHOD_REPORT
         * @href    http://greenbytes.de/tech/webdav/rfc3744.html#rfc.section.9.1
         */
        this.report = function(dav) {
          this.prepare(cob, 'REPORT');
          return this.send(cob); 
        };
  
        /**
         * @href http://greenbytes.de/tech/webdav/rfc3253.html#REPORT_version-tree
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @see     #REPORT
         */
        this.getVersionTreeReport = function(cob) {
          cob.data    = XmlHeader + '\
                          <D:version-tree xmlns:D="DAV:">\
                            <D:prop>\
                              <D:version-name/>\
                              <D:creator-displayname/>\
                              <D:successor-set/>\
                              <D:predecessor-set/>\
                              <D:checkout-set/>\
                              <D:activity-set/>\
                              <D:getlastmodified/>\
                            </D:prop>\
                          </D:version-tree>';
                          
          extendBeforeSend(cob, function(xhr) {
            xhr.setRequestHeader('Depth', 0);
          });
          
          this.prepare(cob, 'REPORT');
          return this.send(cob);
        };

        /**
         * Checks out a VCR.
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href    http://www.webdav.org/deltav/protocol/rfc3253.html#checkout-in-place.feature
         */
        this.checkout = function(cob) {
          this.prepare(cob, 'CHECKOUT');
          return this.send(cob);  
        };
        
        /**
         * Un-checks-out a VCR -- like a checkin, but without creating a new
         * version, which is the same as rolling back to the pre-checkout state.
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href    http://www.webdav.org/deltav/protocol/rfc3253.html#METHOD_UNCHECKOUT
         */
        this.uncheckout = function(cob) {
          this.prepare(cob, 'UNCHECKOUT');
          return this.send(cob);  
        };
        
        /**
         * Checks in a VCR.
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href     http://www.webdav.org/deltav/protocol/rfc3253.html#checkin.method.applied.to.a.version-controlled.resource
         */
        this.checkin = function(cob) {
          this.prepare(cob, 'CHECKIN');
          return this.send(cob);  
        };
        
        /**
         * Creates a VCR (Version Controlled Resource)
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href http://www.webdav.org/deltav/protocol/rfc3253.html#creating.a.version-controlled.resource
         */
        this.versionControl = function(cob) {
          this.prepare(cob, 'VERSION-CONTROL');
          return this.send(cob);  
        };
        
        /**
         * An alias for PUT.  This allows users to create resources,
         * optionally sending initial resource contents.
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @see     #put
         */
        this.createFile = function(cob) {
          return this.put(cob);
        };
        
        /**
         * An alias for MKCOL.
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @see     #mkcol
         */
        this.createFolder = function(cob) {
          return this.mkcol(cob);
        };

        /**
         * Locks a resource.  
         *
         * @param   {Object}  dav     An object containing options for this call.
         * @href    http://greenbytes.de/tech/webdav/rfc4918.html#METHOD_LOCK
         */
        this.lock = function(cob) {          
          var user      = cob.username    || false;          
          var hdrs      = cob.headers     || {};
          
          cob.lockscope = cob.lockscope   || defaultLockScope;
          cob.locktype  = cob.locktype    || defaultLockType;
          cob.ifExists  = !!cob.ifExists;
          
          hdrs.Timeout  = cob.lockTimeout || 'Second-' + defaultLockTimeout;
          hdrs.Depth    = cob.depth       || defaultLockDepth;
                              
          /**
           * If-Match * will stop a lock from being taken on an unmapped
           * url -- which would normally create an locked, empty, resource.
           */
          if(cob.ifExists) {
            hdrs['If-Match'] = '*';
          }
              
          /**
           * Create the <owner> block.  If the user is authenticated,
           * this becomes '/home/usernamehere'. NOTE: your Dav implementation 
           * may NOT use the /home/ protocol: it may not be a multiuser implementation, 
           * or uses a different directory, or something else.
           */
          if(user) {
            cob.data    =  XmlHeader + '\
              <D:lockinfo xmlns:D="DAV:">\
                <D:lockscope>\
                  <D:' + cob.lockscope + '/>\
                </D:lockscope>\
                <D:locktype>\
                  <D:' + cob.locktype + '/>\
                </D:locktype>\
                  <D:owner>' + userHomeDir + user + '</D:owner>\
              </D:lockinfo>'; 
            
            this.prepare(cob, 'LOCK');
            return this.send(cob); 
          }
        };
        
        /**
         * Attempts to unlock a resource
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @href    http://greenbytes.de/tech/webdav/rfc4918.html#METHOD_UNLOCK
         */
        this.unlock = function(cob) {
          var t = cob.lockToken;
          /**
           * Need a locktoken to unlock...
           */
          if(t) {
            extendBeforeSend(cob, function(xhr) {
              xhr.setRequestHeader('Lock-Token', '<' + t + '>');
            });
            this.prepare(cob, 'UNLOCK');
            return this.send(cob); 
          }
        };
        
        /**
         * PROPFIND
         * You can always call this method directly, being sure to pass the
         * proper Xml request body in call object (#data).  However, the 
         * intention is to have this be the 'engine' that powers useful
         * variations on #propFind, doing the prepping for the user.
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @see     #getProperty
         * @url     http://www.webdav.org/specs/rfc2518.html#METHOD_PROPFIND
         * 
         */
        this.propFind = function(cob) {
          this.prepare(cob, 'PROPFIND');

          var depth = cob.headers.depth || 0;
          /*
           * Need to ensure that there is header information sent. Mainly,
           * for a PROPFIND there must be a depth property. Note that the
           * default depth is zero(0).
           */
          extendBeforeSend(cob, function(xhr) {
            xhr.setRequestHeader('Depth', depth);
          });
          
          return this.send(cob);
        };
        
        /**
         * PROPPATCH
         * Allows the modification of live properties on resources.  You
         * may pass a property to set, or a property to remove, or both.
         * Namespacing is also permitted.
         *
         * @param   {Object}    cob   A jQuery#ajax call object w/ props:
         *
         * @example   #propPatch({
         *              // standard jQuery#ajax properties
         *              setProperty:    A property object, or an Array of 
         *                              property objects to set.
         *              removeProperty: A property object, or an Array of
         *                              property objects to remove.
         *            });
         *
         * A property object: {
         *  name:   'propertyName',
         *  value:  'foo',
         *  ns:     'ME:'
         * };
         *
         * @see     #setProperty
         * @url     http://www.webdav.org/specs/rfc2518.html#METHOD_PROPPATCH
         * 
         */
        this.propPatch = function(cob) {
          this.prepare(cob, 'PROPPATCH');
          
          cob.setProperty     = cob.setProperty
                                ? isArray(cob.setProperty) 
                                  ? cob.setProperty
                                  : [cob.setProperty]
                                : [];
          cob.removeProperty  = cob.removeProperty
                                ? isArray(cob.removeProperty) 
                                  ? cob.removeProperty
                                  : [cob.removeProperty]
                                : [];

          cob.data    = XmlHeader + '<D:propertyupdate xmlns:D="DAV:">';
  
          var grouper = function(nm) { 
            var prop;
            var props   = cob[nm + "Property"];
            var block   = '<D:' + nm + '><D:prop>';
            
            for(var i = 0; i < props.length; i++) {
              prop = props[i];
              if(prop.name) {
                block +=  "<P:" + prop.name + " xmlns:P=\"" + 
                          (prop.ns || "DAV:") + 
                          "\">" + prop.value + "</P:" + 
                          prop.name + ">"; 
              }
            }
            block += '</D:prop></D:' + nm + '>';
            return block;
          };
  
          cob.data += grouper("set");
          cob.data += grouper("remove");
  
          cob.data += '</D:propertyupdate>';

          return this.send(cob); 
        };
      
        /**
         * Fetches a property on a resource.
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @see     #propFind
         */
        this.getProperty = function(cob) {
          var props = cob.property || [];
          var prop, i, xml;

          for(i=0; i < props.length; i++) 
            {
              prop = props[i];
              
              /**
               * Also want to allow the sending of a simple property string
               * if only sending a property name. Instead of:
               *   [{name: 'propname'}]
               * send:
               *   ['propname']
               */
              prop      = isObject(prop) ? prop : {name:prop};
              prop.ns   = prop.ns || 'DAV:';
              
              xml       = "<P:" + prop.name + " xmlns:P='" + prop.ns + "'/>";
            }
          
          cob.data  = XmlHeader + '\
       	                <propfind xmlns="DAV:">\
       	                  <prop>\
       	                    ' + xml + '\
       	                  </prop>\
         	              </propfind>';

         	return this.propFind(cob);
        };
        
        /**
         * Shortcut method for propPatch (set property).
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @see #propPatch
         */
        this.setProperty = function(cob) {
          /**
           * Only works if sent a property...
           */
          if(cob.property) {
            cob.setProperty = cob.property;
            delete cob.property;
            return this.propPatch(cob);
          } 
        };
        
        /**
         * Shortcut method for propPatch (remove property).
         *
         * @param   {Object}    cob   A jQuery#ajax call object.
         * @see #propPatch
         */
        this.removeProperty = function(cob) {
          /**
           * Only works if sent a property...
           */
          if(cob.property) {
            cob.removeProperty = cob.property;
            delete cob.property;
            return this.propPatch(cob);
          }  
        };

                  
        /******************************************
         * 
         * Node traversal/manipulation methods
         *
         ******************************************/          
                  
                  
        /**
         * Works exactly like getElementsByTagName, however introduces
         * the ability to filter those results by namespace, which is 
         * important for handling DAV results. 
         *
         * @param   {String}    tag     A tagName.
         * @param   {String}    [ns]    A namespace, like 'DAV:'.
         * @returns                     Array of matching nodes.
         * @type    {Array}
         */
        this.getNodesByTag = function(tag, ns) {
        
          ns = ns || 'DAV:';
          
          if(typeof resource.getElementsByTagNameNS === 'function') {
            lastNodeMatch = resource.getElementsByTagNameNS(ns, tag);
          }
          else {
            /**
             * For IE mostly.
             */
            resource.setProperty("SelectionLanguage", "XPath");
            resource.setProperty("SelectionNamespaces", "xmlns:pref='" + ns + "'");
            
            lastNodeMatch = resource.selectNodes("//pref:" + tag);
          }
          return lastNodeMatch;
        };
        
        /**
         * Sets `resource` to first node matched via #getNodesByTag, and 
         * returns `this`, allowing further processing.
         *
         * @param   {String}    tag     A tagName.
         * @param   {String}    [ns]    A namespace, like 'DAV:'.
         * @returns                     `this` object
         * @type    {Object}
         */
        this.seekToNode = function(tag, ns) {
          var n     = this.getNodesByTag(tag, ns);  
          resource  = n[0] || resource;
          return this;
        };
        
        /**
         * Executes a function on each element of #lastNodeMatch
         */
        this.eachNode = function(f) {
          var i;

          for(i=0; i < lastNodeMatch.length; i++) {
            f(lastNodeMatch[i], i);  
          }  
            
          return this;
        };
        
        /**
         * Get the text contained by a node:
         * <tagname>foo</tagname> = 'foo'.
         *
         * @type      {String}
         */
        this.nodeText = function() {
          var n, t = '';
          for(var v=0; v < resource.childNodes.length; v++) {
            n = resource.childNodes[v];
            t += n.textContent ? n.textContent : n.text;
          }
          return t.replace(/[\n\r\t]/g,'');
        };
        
        /**
         * Returns the name of a node (the tag name, essentially). NOTE: result
         * returned by #getNodesByTag is an Array.  As such, even if the
         * node you have sought (by tagName) is unique, the value of `resource`
         * is an Array. Note as well that if you do not send an index argument, the
         * assumption made is that you want the [0] nodeName.  If you choose to use
         * an index, no bounds checking is done, and you will get an error if outside.
         * If `resource` is actually a single node, index is ignored.
         *
         * @param   {Number}    [i]     The index of 
         * @see #getNodesByTag
         * @see #seekToNode
         */
        this.nodeName = function(i) {
          if(lastNodeMatch.length > 0) {
            return lastNodeMatch[i || 0].nodeName.replace('D:', '');
          }
        };
        
        /**************************************
         * 
         * Resource Http query methods
         *
         **************************************/
        
        /**
         * Prepares the DAV call.  Here we want to ensure integrity of
         * call object, verify DAV method requested, set any authorization
         * information (if necesssary), and return the modified call object.
         * NOTE: This is called by the new jQuery extension #Dav; see below.
         *
         * @param   {Object}    cob       The call object.  This is the standard jQuery
         *                                #ajax object. Note the defaults set here.
         * @param   {String}    typ       The call type.   
         */
        this.prepare = function(cob, typ) {
          
          cob           = cob || {};
          cob.url       = resourceUrl;
          cob.headers   = cob.headers || {};
          
          /**
           * Ensure that we have a method set, defaulting to GET.
           */
          cob.type      = typ || 'GET';
      
          /**
           * WebDAV servers usually respond in XML.  Some Dav methods will 
           * not return anything at all, or return an empty response.  This 
           * matters to jQuery in that the #success method of a jQuery.ajax
           * options object won't fire if the reponse could not be parsed 
           * (although the #complete method will).  You should be aware of what
           * the #dataType of your ajax response will be, and set it appropriately.
           */
          cob.dataType  = cob.dataType || 'xml';

          /**
           * For Http methods not supported by the current browser, we use a
           * specialized PUT with query.  NOTE that this particular behaviour exists
           * on the LimeBits server only.  If you do not extend the same support to
           * your Dav server, it is simple to be optimistic and rewrite so that the
           * browser attempts to send Dav Http methods, and will simply fail if it
           * cannot.  See jQuery documentation on #ajax options regarding non-regular
           * Http method failures, for option #type.
           */
          if(!methodSupported(cob.type)) {
            
            /**
             * Fetch authentication data, which is necessary for the execution of
             * any methods, by this user, which are DENY-d to 'unauthenticated' principal.
             */
            var auth = document.cookie.match(new RegExp('(^|;)\\s*' + escape("auth") + '=([^;\\s]*)'));
            auth = auth ? unescape(auth[2]) : null;
            
            if(auth) {
              auth = "&auth=" + auth;
            } 
            else {
              auth = "";
            }
                  
            cob.url += "?webdav-method=" + cob.type.toUpperCase() + auth;
            cob.type = 'POST';
          }
        };
        
        /**
         * Does the actual Http send.
         *
         * @param   {Object}    cob     jQuery call object.
         */
        this.send = function(cob) {   
          lastRequest = $.ajax(cob);
          return lastRequest; 
        };
        
        /************************************************************
         *                                
         * Some optional, additional methods you might want to use.
         *
         ************************************************************/
        
        this.getAllProperties = function(cob) {
          cob.data    = XmlHeader + '\
                  	      <D:propfind xmlns:D="DAV:">\
                   	        <D:allprop/>';
                     	        
          if(isArray(cob.includes)) {
            cob.data    +=  '<D:include>'; 
              
            for(var i=0; i < d.includes.length; i++) {
              cob.body  += '<D:' + d.includes[i] + '/>';
            }
              
            cob.data    +=  '</D:include>';
          }              
            
          cob.data      += '</D:propfind>';
          return this.propFind(cob);
        };
        
        /**
         * Simply a depth (1) #getAllProperties -- an alias that should
         * make it easier to follow what is going on, Dav.readFolder() 
         * instead of Dav.getAllProperties({ depth: 1 });
         */
        this.readFolder = function(cob) {
          /**
           * Since this ends up in a #propFind, we only need to
           * indicate the headers -- the extension of the headers
           * will be done in the #propFind method.  We don't need
           * to run #extendBeforeSend manually, in other words.
           */
          cob.headers     = {
            depth:  1
          };

          return this.getAllProperties(cob);
        };
 
      }; // End Dav api definition
      
      return new api; 
      
    } // End Dav extension definition

  }); // End jQuery.fn.extend
  
})(jQuery);

