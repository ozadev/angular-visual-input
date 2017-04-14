
(function () {
  'use strict';

  angular.module('angularVisualInput', [
    'textAngular'
  ]);

  angular.module('angularVisualInput').config(['$provide',
    function($provide) {
      $provide.decorator('taOptions', ['taRegisterTool', '$delegate',
        function(taRegisterTool, taOptions) {
          // $delegate is the taOptions we are decorating
          // here we override the default toolbars specified in taOptions.
          taOptions.toolbar = [];

          taOptions.disableSanitizer = true;

          return taOptions;
        }
      ]);
    }
  ]);

  angular.module('angularVisualInput')
      .filter('htmlToPlaintext', function() {
          return function(text) {
            return angular.element(text).text();
          }
        }
    );

  angular.module('angularVisualInput')
      .filter('filterByName', function() {
        return function(items, filterText) {
          var result = {};
          angular.forEach(items, function(value, key) {
            if (value.name.search(filterText) !== -1) {
              result[key] = value;
            }
          });
          return result;
        };
  });

  angular.module('angularVisualInput').directive('angularVisualInput', [
    '$document',
    '$window',
    '$interval',
    '$timeout',
    '$filter',
    'textAngularManager',
    function ($document, $window, $interval, $timeout, $filter, textAngularManager) {
      return {
        templateUrl: './angularVisualInput/angularVisualInput.html',
        restrict: 'AE',
        replace: true,
        scope: {
          variables: '=',
          textModel: '=',
          twoWayBindingOn: '=',
          editorId: '@'
        },
        link: function (scope, element, attr) {

          var savedSelection;
          var internalModify = false;
          var editor = textAngularManager.retrieveEditor('editor' + scope.editorId).scope;
          var editorIsInFocus = false;

          scope.isOpened = false;
          scope.placeElement = placeElement;
          scope.saveCursor = saveCursor;
          scope.select = select;
          scope.filterText = '';

          scope.stripFormat = function ($html) {
            return $filter('htmlToPlaintext')($html);
          };

          // initialization
          scope.textView = transformToView(scope.textModel);


          // One way bindings watcher
          scope.$watch(function() {
            return scope.textView;
          }, function() {
            internalModify = true;
            scope.textModel = transformToText(scope.textView);
          });

          // Two way bindings watcher
          if (scope.twoWayBindingOn) {
            scope.$watch(function() {
              return scope.textModel;
            }, function() {
              if(internalModify) {
                internalModify = false;
              }
              else {
                scope.textView = transformToView(scope.textModel);
              }
            });

          }

          // Listener for editor focus event
          editor.displayElements.text.bind('focus', function() {
            editorIsInFocus = true;
          });

          // Listener for editor blur event
          editor.displayElements.text.bind('blur', function() {
            editorIsInFocus = false;
          });


          // Close at click outside
          $document.on('click', function (e) {
            if (element !== e.target && !element[0].contains(e.target)) {
              scope.$apply(function () {
                scope.$eval(scope.isOpened = false);
              });
            }
          });

          //
          // Functions declaration
          //

          // Transform {{}} => template view
          function transformToView(text) {

            if (angular.isString(text) === false) {
              return ''
            }

            // var varsArr = text.match(/\{([^}]+)\}}/gm); // with {{}}
            var varsArr = text.match(/([^{{]*?)\w(?=\}})/gmi); // without {{}}
            if(varsArr) {
              varsArr.forEach(function(item) {
                text = text.replace('{{' + item + '}}', createLabel(item)[0].outerHTML + '&nbsp');
              });
            }

            // replace new line character with special template
            var linesArr = text.split('\n');
            if (linesArr) {
              linesArr.forEach(function(item, index) {
                if(index === 0) {
                  text = '<p>' + item + '</p>';
                }
                else {
                  text += '<div><p>' + item + '</p></div>';
                }
              });
            }

            return text;
          }

          // Transform template view => {{}}
          function transformToText(view) {

            var elem = angular.element('<div>')[0];
            elem.innerHTML = view;

            // remove rangy-core internal elements
            var rangyMarkers = elem.querySelectorAll('span.rangySelectionBoundary');
            if (rangyMarkers) {
              [].forEach.call(rangyMarkers, function(item) {
                // item.remove()
                item.parentNode.removeChild(item); // IE11 bug
              });
            }

            // replace template with {{}}
            var customList = elem.querySelectorAll('span.label-template');
            if (customList) {
              [].forEach.call(customList, function(item) {
                item.insertAdjacentHTML('afterEnd', '{{' + item.getAttribute('type') + '}}');
                // item.remove();
                item.parentNode.removeChild(item); // IE11 bug
              });
            }

            // insert /n newline
            var newLineList = elem.querySelectorAll('div');
            if (newLineList) {
              [].forEach.call(newLineList, function(item) {
                item.insertAdjacentHTML('afterEnd', '\n' + item.innerHTML);
                item.parentNode.removeChild(item); // IE11 bug
                // item.remove();
              })
            }

            // Additional trim
            var result = elem.innerHTML.replace(new RegExp('&nbsp;','g'), '');
            result = result.replace(/<[^>]+>/gm, '');

            return result;

          }

          // Save cursor position at select-dropdown open
          function saveCursor() {
            if (scope.isOpened === false) {

              // set editor in focus and place caret to end
              if(!editorIsInFocus) {
                createCaretPlacer(false)(editor.displayElements.text[0]);
              }

              // removes invisible span position marker
              if(angular.isDefined(savedSelection)) {
                $window.rangy.removeMarkers(savedSelection);
              }

              savedSelection = $window.rangy.saveSelection();

            }

          }

          // Create tiny template element
          function createLabel(itemKey) {
            var labelElem = angular.element('<span>');
            labelElem.attr('value', scope.variables[itemKey].name);
            labelElem.attr('type', itemKey);
            labelElem.attr('style', 'background-image: url(' + scope.variables[itemKey].iconSrc + ')');
            labelElem.addClass('label-template');
            return labelElem;
          }

          // Select item from dropdown
          function select(itemKey) {
            placeElement(createLabel(itemKey)[0]);
            scope.isOpened = false;
            scope.filterText = '';
          }

          function placeElement(customElem) {
            editor.displayElements.text[0].focus();
            $window.rangy.restoreSelection(savedSelection);
            // removes invisible span position marker after restore
            $window.rangy.removeMarkers(savedSelection);
            editor.wrapSelection('insertHTML', customElem.outerHTML + '&nbsp', false);
            editor.endAction();
          }

          // function removeMarker

          // Create function to place caret at end
          function createCaretPlacer(atStart) {
            return function(el) {
              el.focus();
              if (typeof window.getSelection != "undefined"
                  && typeof document.createRange != "undefined") {
                var range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(atStart);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
              } else if (typeof document.body.createTextRange != "undefined") {
                var textRange = document.body.createTextRange();
                textRange.moveToElementText(el);
                textRange.collapse(atStart);
                textRange.select();
              }
            };
          }

        }
      }
    }])
})();

