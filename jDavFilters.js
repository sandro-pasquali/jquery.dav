/*
* jDavFilters JQuery plugin v1.0
*
* Copyright 2008 Lime Labs LLC
*
* @author Sandro Pasquali
*
* jDavFilters is free software: you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License
* version 3 as published by the Free Software Foundation.
*
* jDavFilters is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public
* License along with jDavFilters.  If not, see <http://www.gnu.org/licenses/>.
*/

(function($) {
  $.fn.extend($,{ 
    DavFilters: {
      
      /**
       * Will assemble a list of responses into a Javascript data structure,
       * returning an array that can then be manipulated.
       */
      folder: function(dat) {
        var i, curN;
        $.Dav(dat).seekToNode('response').eachNode(function(node, i) {
        });

        return dat;
      },
      
      versionReport: function(dat) {
        console.log('now a davfilter');

        $.Dav(dat).seekToNode('response').eachNode(function(node, i) {
          console.log(node);
          console.log('href: ' + $.Dav(node).seekToNode('href').nodeText());
        });
        
        return dat;
      } 
      
    }
  });
})(jQuery);