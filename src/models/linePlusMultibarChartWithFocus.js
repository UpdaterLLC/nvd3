nv.models.linePlusMultiBarChartWithFocus = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var lines = nv.models.line()
        , lines2 = nv.models.line()
        , bars = nv.models.multiBar()
        , bars2 = nv.models.multiBar()
        , xAxis = nv.models.axis()
        , x2Axis = nv.models.axis()
        , y1Axis = nv.models.axis()
        , y2Axis = nv.models.axis()
        , y3Axis = nv.models.axis()
        , y4Axis = nv.models.axis()
        , legend = nv.models.legend()
        , controls = nv.models.legend()
        , brush = d3.svg.brush()
        , tooltip = nv.models.tooltip()
        ;

    var margin = {top: 30, right: 30, bottom: 30, left: 60}
        , margin2 = {top: 0, right: 30, bottom: 20, left: 60}
        , width = null
        , height = null
        , getX = function(d) { return d.x }
        , getY = function(d) { return d.y }
        , color = nv.utils.defaultColor()
        , showControls = true
        , controlLabels = {}
        , showLegend = true
        , showXAxis = true
        , showYAxis = true
        , reduceXTicks = false // if false a tick will show for every data point
        , staggerLabels = false
        , rotateLabels = 0
        , focusEnable = true
        , focusShowAxisY = true
        , focusShowAxisX = true
        , focusHeight = 50
        , extent
        , brushExtent = null
        , x //can be accessed via chart.xScale()
        , x2
        , y1
        , y2
        , y3
        , y4
        , state = nv.utils.state()
        , defaultState = null
        , noData = null
        , dispatch = d3.dispatch('brush', 'stateChange', 'changeState', 'renderEnd')
        , controlWidth = function() { return showControls ? 200 : 0 }
        , transitionDuration = 0
        , legendLeftAxisHint = ' (left axis)'
        , legendRightAxisHint = ' (right axis)'
        ;

    bars.stacked(true);
    bars2.stacked(true);
    // We don't want any points emitted for the focus chart's scatter graph.

    lines.clipEdge(true);
    lines2.interactive(false);
    // We don't want any points emitted for the focus chart's scatter graph.
    lines2.pointActive(function(d) { return false });

    //focus graph's axis
    xAxis .orient('bottom') .tickPadding(7) .showMaxMin(false);
    y1Axis.orient('left') .showMaxMin(false);
    y2Axis.orient('right') .showMaxMin(false);

    //content graph's axis
    x2Axis.orient('bottom') .tickPadding(7) .showMaxMin(false);
    y3Axis.orient('left') .showMaxMin(false);
    y4Axis.orient('right') .showMaxMin(false);

    tooltip
        .duration(0)
        .valueFormatter(function(d, i) {
            return y2Axis.tickFormat()(d, i);
        })
        .headerEnabled(true)
        .headerFormatter(function(d, i) {
          return xAxis.tickFormat()(d, i);
        })
    ;

    controls.updateState(false);

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch);
    var stacked = true;

    var stateGetter = function(data) {
        return function(){
            return {
                active: data.map(function(d) { return !d.disabled }),
                stacked: stacked
            };
        }
    };

    var stateSetter = function(data) {
        return function(state) {
            if (state.stacked !== undefined)
                stacked = state.stacked;
            if (state.active !== undefined)
                data.forEach(function(series,i) {
                    series.disabled = !state.active[i];
                });
        }
    };

    var allDisabled = function(data) {
      return data.every(function(series) {
        return series.disabled;
      });
    };

    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(bars);
        if (showXAxis) renderWatch.models(xAxis);
        if (showYAxis) renderWatch.models(y1Axis);

        selection.each(function(data) {
            var container = d3.select(this);

            nv.utils.initSVG(container);

            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight1 = nv.utils.availableHeight(height, container, margin) - (focusEnable ? focusHeight : 0),
                availableHeight2 = focusHeight - margin2.top - margin2.bottom;

            chart.update = function () {
                if (transitionDuration === 0)
                    container.call(chart);
                else
                    container.transition()
                      .duration(transitionDuration)
                      .call(chart);
            };

            chart.container = this;

            state
                .setter(stateSetter(data), chart.update)
                .getter(stateGetter(data))
                .update();

            // DEPRECATED set state.disabled
            state.disabled = data.map(function(d) { return !!d.disabled });

            if (!defaultState) {
                var key;
                defaultState = {};
                for (key in state) {
                    if (state[key] instanceof Array)
                        defaultState[key] = state[key].slice(0);
                    else
                        defaultState[key] = state[key];
                }
            }

            // Display No Data message if there's nothing to show.
            if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
                nv.utils.noData(chart, container);
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            // Setup Scales
            var dataBars = data.filter(function(d) { return !d.disabled && d.bar });
            var dataLines = data.filter(function(d) { return !d.bar }); // removed the !d.disabled clause here to fix Issue #240

            x = xAxis.scale();
            y1 = bars.yScale();
            y2 = lines.yScale();

            x2 = x2Axis.scale();
            y3 = bars2.yScale();
            y4 = lines2.yScale();

            var series1 = data
                .filter(function(d) { return !d.disabled && d.bar })
                .map(function(d) {
                    return d.values.map(function(d,i) {
                        return { x: getX(d,i), y: getY(d,i) }
                    })
                });

            var series2 = data
                .filter(function(d) { return !d.disabled && !d.bar })
                .map(function(d) {
                    return d.values.map(function(d,i) {
                        return { x: getX(d,i), y: getY(d,i) }
                    })
                });

            x.range([0, availableWidth]);

            x2  .domain(d3.extent(d3.merge(series1.concat(series2)), function(d) { return d.x } ))
                .range([0, availableWidth]);

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-linePlusMultibarChartWithFocus').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-linePlusMultibarChartWithFocus').append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-legendWrap');
            gEnter.append('g').attr('class', 'nv-controlsWrap');

            // this is the main chart
            var focusEnter = gEnter.append('g').attr('class', 'nv-focus');
            focusEnter.append('g').attr('class', 'nv-x nv-axis');
            focusEnter.append('g').attr('class', 'nv-y1 nv-axis');
            focusEnter.append('g').attr('class', 'nv-y2 nv-axis');
            focusEnter.append('g').attr('class', 'nv-barsWrap');
            focusEnter.append('g').attr('class', 'nv-linesWrap');

            // context chart is where you can focus in
            var contextEnter = gEnter.append('g').attr('class', 'nv-context');
            contextEnter.append('g').attr('class', 'nv-x nv-axis');
            contextEnter.append('g').attr('class', 'nv-y1 nv-axis');
            contextEnter.append('g').attr('class', 'nv-y2 nv-axis');
            contextEnter.append('g').attr('class', 'nv-barsWrap');
            contextEnter.append('g').attr('class', 'nv-linesWrap');
            contextEnter.append('g').attr('class', 'nv-brushBackground');
            contextEnter.append('g').attr('class', 'nv-x nv-brush');

            //============================================================
            // Legend
            //------------------------------------------------------------

            // Legend
            if (showLegend) {
                var legendWidth = legend.align() ? availableWidth / 2 : availableWidth - controlWidth();
                var legendXPosition = legend.align() ? legendWidth : 0;

                legend.width(legendWidth);

                g.select('.nv-legendWrap')
                    .datum(data)
                    .call(legend);

                if ( margin.top != legend.height()) {
                    margin.top = legend.height();
                    // FIXME: shouldn't this be "- (focusEnabled ? focusHeight : 0)"?
                    availableHeight1 = nv.utils.availableHeight(height, container, margin) - focusHeight;
                }

                g.select('.nv-legendWrap')
                    .attr('transform', 'translate(' + legendXPosition + ',' + (-margin.top) +')');
            }

            // Controls
            if (showControls) {
                var controlsData = [
                    { key: controlLabels.grouped || 'Grouped', disabled: bars.stacked() },
                    { key: controlLabels.stacked || 'Stacked', disabled: !bars.stacked() }
                ];

                controls.width(controlWidth())
                  .color(['#444', '#444', '#444']);

                g.select('.nv-controlsWrap')
                  .datum(controlsData)
                  .call(controls);

                g.select('.nv-controlsWrap')
                  .attr('transform', 'translate(0,' + (-margin.top) +')');
            }

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            //============================================================
            // Context chart (focus chart) components
            //------------------------------------------------------------

            // hide or show the focus context chart
            g.select('.nv-context').style('display', focusEnable ? 'initial' : 'none');

            bars2
                .disabled(data.map(function(series) { return series.disabled }))
                .width(availableWidth)
                .height(availableHeight2)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                    return !data[i].disabled && data[i].bar
                }));
            lines2
                .width(availableWidth)
                .height(availableHeight2)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);
                }).filter(function (d, i) {
                    return !data[i].disabled && !data[i].bar
                }));

            var bars2Wrap = g.select('.nv-context .nv-barsWrap')
                .datum(dataBars.length ? dataBars : [
                    {values: []}
                ]);
            var lines2Wrap = g.select('.nv-context .nv-linesWrap')
                .datum(allDisabled(dataLines) ?
                       [{values: []}] :
                       dataLines.filter(function(dataLine) {
                         return !dataLine.disabled;
                       }));

            g.select('.nv-context')
                .attr('transform', 'translate(0,' + ( availableHeight1 + margin.bottom + margin2.top) + ')');

            bars2Wrap.transition().call(bars2);
            lines2Wrap.transition().call(lines2);

            // context (focus chart) axis controls
            if (focusShowAxisX) {
                x2Axis
                    ._ticks( nv.utils.calcTicksX(availableWidth / 100, data))
                    .tickSize(-availableHeight2, 0);
                g.select('.nv-context .nv-x.nv-axis')
                    .attr('transform', 'translate(0,' + y3.range()[0] + ')');
                g.select('.nv-context .nv-x.nv-axis').transition()
                    .call(x2Axis);
            }

            if (focusShowAxisY) {
                y3Axis
                    .scale(y3)
                    ._ticks( availableHeight2 / 36 )
                    .tickSize( -availableWidth, 0);
                y4Axis
                    .scale(y4)
                    ._ticks( availableHeight2 / 36 )
                    .tickSize(dataBars.length ? 0 : -availableWidth, 0); // Show the y2 rules only if y1 has none

                g.select('.nv-context .nv-y3.nv-axis')
                    .style('opacity', dataBars.length ? 1 : 0)
                    .attr('transform', 'translate(0,' + x2.range()[0] + ')');
                g.select('.nv-context .nv-y2.nv-axis')
                    .style('opacity', dataLines.length ? 1 : 0)
                    .attr('transform', 'translate(' + x2.range()[1] + ',0)');

                g.select('.nv-context .nv-y1.nv-axis').transition()
                    .call(y3Axis);
                g.select('.nv-context .nv-y2.nv-axis').transition()
                    .call(y4Axis);
            }

            // Setup Brush
            brush.x(x2).on('brush', onBrush);

            if (brushExtent) brush.extent(brushExtent);

            var brushBG = g.select('.nv-brushBackground').selectAll('g')
                .data([brushExtent || brush.extent()]);

            var brushBGenter = brushBG.enter()
                .append('g');

            brushBGenter.append('rect')
                .attr('class', 'left')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', availableHeight2);

            brushBGenter.append('rect')
                .attr('class', 'right')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', availableHeight2);

            var gBrush = g.select('.nv-x.nv-brush')
                .call(brush);
            gBrush.selectAll('rect')
                //.attr('y', -5)
                .attr('height', availableHeight2);
            gBrush.selectAll('.resize').append('path').attr('d', resizePath);

            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

            legend.dispatch.on('stateChange', function(newState) {
                for (var key in newState)
                    state[key] = newState[key];
                dispatch.stateChange(state);
                chart.update();
            });

            controls.dispatch.on('legendClick', function(d,i) {
                if (!d.disabled) return;
                controlsData = controlsData.map(function(s) {
                    s.disabled = true;
                    return s;
                });
                d.disabled = false;

                switch (d.key) {
                    case 'Grouped':
                    case controlLabels.grouped:
                        bars.stacked(false);
                        bars2.stacked(false);
                        break;
                    case 'Stacked':
                    case controlLabels.stacked:
                        bars.stacked(true);
                        bars2.stacked(true);
                        break;
                }

                stacked = state.stacked = bars.stacked();
                dispatch.stateChange(state);
                chart.update();
            });

            // Update chart from a state object passed to event handler
            dispatch.on('changeState', function(e) {
                if (typeof e.disabled !== 'undefined') {
                    data.forEach(function(series,i) {
                        series.disabled = e.disabled[i];
                    });
                    state.disabled = e.disabled;
                }
                if (typeof e.stacked !== 'undefined') {
                    bars.stacked(e.stacked);
                    bars2.stacked(e.stacked);
                    stacked = state.stacked = e.stacked;
                }
                chart.update();
            });

            //============================================================
            // Functions
            //------------------------------------------------------------

            // Taken from crossfilter (http://square.github.com/crossfilter/)
            function resizePath(d) {
                var e = +(d == 'e'),
                    x = e ? 1 : -1,
                    y = availableHeight2 / 3;
                return 'M' + (.5 * x) + ',' + y
                    + 'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6)
                    + 'V' + (2 * y - 6)
                    + 'A6,6 0 0 ' + e + ' ' + (.5 * x) + ',' + (2 * y)
                    + 'Z'
                    + 'M' + (2.5 * x) + ',' + (y + 8)
                    + 'V' + (2 * y - 8)
                    + 'M' + (4.5 * x) + ',' + (y + 8)
                    + 'V' + (2 * y - 8);
            }


            function updateBrushBG() {
                if (!brush.empty()) brush.extent(brushExtent);
                brushBG
                    .data([brush.empty() ? x2.domain() : brushExtent])
                    .each(function(d,i) {
                        var leftWidth = x2(d[0]) - x2.range()[0],
                            rightWidth = x2.range()[1] - x2(d[1]);
                        d3.select(this).select('.left')
                            .attr('width',  leftWidth < 0 ? 0 : leftWidth);

                        d3.select(this).select('.right')
                            .attr('x', x2(d[1]))
                            .attr('width', rightWidth < 0 ? 0 : rightWidth);
                    });
            }

            function onBrush() {
                brushExtent = brush.empty() ? null : brush.extent();
                extent = brush.empty() ? x2.domain() : brush.extent();
                dispatch.brush({extent: extent, brush: brush});
                updateBrushBG();

                // Prepare Main (Focus) Bars and Lines
                bars
                    .disabled(data.map(function(series) { return series.disabled }))
                    .width(availableWidth)
                    .height(availableHeight1)
                    .color(data.map(function(d,i) {
                        return d.color || color(d, i);
                    }).filter(function(d,i) { return !data[i].disabled && data[i].bar }));

                lines
                    //.disabled(data.map(function(series) { return series.disabled }))
                    .width(availableWidth)
                    .height(availableHeight1)
                    .color(data.map(function(d,i) {
                        return d.color || color(d, i);
                    }).filter(function(d,i) { return !data[i].disabled && !data[i].bar }));

                var focusBarsWrap = g.select('.nv-focus .nv-barsWrap')
                    .datum(!dataBars.length ? [{values:[]}] :
                        dataBars
                            .map(function(d,i) {
                                return {
                                    key: d.key,
                                    values: d.values.filter(function(d,i) {
                                        return bars.x()(d,i) >= extent[0] && bars.x()(d,i) <= extent[1];
                                    })
                                }
                            })
                );

                var focusLinesWrap = g.select('.nv-focus .nv-linesWrap')
                    .datum(allDisabled(dataLines) ? [{values:[]}] :
                           dataLines
                           .filter(function(dataLine) { return !dataLine.disabled; })
                           .map(function(d,i) {
                                return {
                                    area: d.area,
                                    fillOpacity: d.fillOpacity,
                                    key: d.key,
                                    values: d.values.filter(function(d,i) {
                                        return lines.x()(d,i) >= extent[0] && lines.x()(d,i) <= extent[1];
                                    })
                                }
                            })
                );

                // Update Main (Focus) X Axis
                //if (dataBars.length) {
                //    x = bars.xScale();
                //} else {
                //    x = lines.xScale();
                //}

                if (showXAxis) {

                    xAxis
                        //.scale(x)
                        ._ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                        .tickSize(-availableHeight1, 0);

                    if (extent[0] instanceof Date) {
                        xAxis.domain([Math.ceil(extent[0]), Math.floor(extent[1])]);
                    } else {
                        xAxis.domain([extent[0], extent[1]]);
                    }

                    g.select('.nv-focus .nv-x.nv-axis')
                        .attr('transform', 'translate(0,' + y1.range()[0] + ')');
                    g.select('.nv-focus .nv-x.nv-axis').transition()
                        .duration(transitionDuration)
                        .call(xAxis);

                    var xTicks = g.select('.nv-x.nv-axis > g').selectAll('g');

                    xTicks
                        .selectAll('line, text')
                        .style('opacity', 1);

                    //if (staggerLabels) {
                    //    var getTranslate = function(x,y) {
                    //        return "translate(" + x + "," + y + ")";
                    //    };
                    //
                    //    var staggerUp = 5, staggerDown = 17;  //pixels to stagger by
                    //    // Issue #140
                    //    xTicks
                    //        .selectAll("text")
                    //        .attr('transform', function(d,i,j) {
                    //            return  getTranslate(0, (j % 2 === 0 ? staggerUp : staggerDown));
                    //        });
                    //
                    //    var totalInBetweenTicks = d3.selectAll(".nv-x.nv-axis .nv-wrap g g text")[0].length;
                    //    g.selectAll(".nv-x.nv-axis .nv-axisMaxMin text")
                    //        .attr("transform", function(d,i) {
                    //            return getTranslate(0, (i === 0 || totalInBetweenTicks % 2 !== 0) ? staggerDown : staggerUp);
                    //        });
                    //}

                    //if (reduceXTicks)
                    //    xTicks
                    //        .filter(function(d,i) {
                    //            return i % Math.ceil(data[0].values.length / (availableWidth / 100)) !== 0;
                    //        })
                    //        .selectAll('text, line')
                    //        .style('opacity', 0);
                    //
                    //if(rotateLabels)
                    //    xTicks
                    //        .selectAll('.tick text')
                    //        .attr('transform', 'rotate(' + rotateLabels + ' 0,0)')
                    //        .style('text-anchor', rotateLabels > 0 ? 'start' : 'end');

                    g.select('.nv-focus .nv-x.nv-axis').selectAll('g.nv-axisMaxMin text')
                        .style('opacity', 1);
                }

                // Update Main (Focus) Bars and Lines
                focusBarsWrap.transition().duration(transitionDuration).call(bars);
                focusLinesWrap.transition().duration(transitionDuration).call(lines);

                // Setup and Update Main (Focus) Y Axes
                if (showYAxis) {
                    g.select('.nv-focus .nv-x.nv-axis')
                        .attr('transform', 'translate(0,' + y1.range()[0] + ')');

                    y1Axis
                        .scale(y1)
                        ._ticks(nv.utils.calcTicksY(availableHeight1 / 36, data))
                        .tickSize(-availableWidth, 0);
                    y2Axis
                        .scale(y2)
                        ._ticks(nv.utils.calcTicksY(availableHeight1 / 36, data))
                        .tickSize(dataBars.length ? 0 : -availableWidth, 0); // Show the y2 rules only if y1 has none

                    g.select('.nv-focus .nv-y1.nv-axis')
                        .style('opacity', dataBars.length ? 1 : 0);
                    g.select('.nv-focus .nv-y2.nv-axis')
                        .style('opacity', dataLines.length && !allDisabled(dataLines) ? 1 : 0)
                        .attr('transform', 'translate(' + x.range()[1] + ',0)');

                    g.select('.nv-focus .nv-y1.nv-axis').transition().duration(transitionDuration)
                        .call(y1Axis);
                    g.select('.nv-focus .nv-y2.nv-axis').transition().duration(transitionDuration)
                        .call(y2Axis);
                }
            }

            onBrush();

        });

        renderWatch.renderEnd('linePlusMultibarChartWithFocus immediate');
        return chart;
    }

    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    lines.dispatch.on('elementMouseover.tooltip', function(evt) {
        tooltip
            .duration(100)
            .valueFormatter(function(d, i) {
                return y2Axis.tickFormat()(d, i);
            })
            .data(evt)
            .position(evt.pos)
            .hidden(false);
    });

    lines.dispatch.on('elementMouseout.tooltip', function(evt) {
        tooltip.hidden(true)
    });

    bars.dispatch.on('elementMouseover.tooltip', function(evt) {
        evt.value = chart.x()(evt.data);
        if (!stacked || chart.y()(evt.data) > 0) {
            evt['series'] = {
                key: evt.data.key,
                value: chart.y()(evt.data),
                color: evt.color
            };
            tooltip
              .duration(0)
              .valueFormatter(function(d, i) {
                  return y1Axis.tickFormat()(d, i);
              })
              .data(evt)
              .hidden(false);
        }
    });

    bars.dispatch.on('elementMouseout.tooltip', function(evt) {
        tooltip.hidden(true);
    });

    bars.dispatch.on('elementMousemove.tooltip', function(evt) {
        tooltip.position({top: d3.event.pageY, left: d3.event.pageX})();
    });

    //============================================================


    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.dispatch = dispatch;
    chart.legend = legend;
    chart.controls = controls;
    chart.lines = lines;
    chart.lines2 = lines2;
    chart.bars = bars;
    chart.bars2 = bars2;
    chart.xAxis = xAxis;
    chart.x2Axis = x2Axis;
    chart.y1Axis = y1Axis;
    chart.y2Axis = y2Axis;
    chart.y3Axis = y3Axis;
    chart.y4Axis = y4Axis;
    chart.state = state;
    chart.tooltip = tooltip;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
        showControls: {get: function(){return showControls;}, set: function(_){showControls=_;}},
        controlLabels: {get: function(){return controlLabels;}, set: function(_){controlLabels=_;}},
        showXAxis:      {get: function(){return showXAxis;}, set: function(_){showXAxis=_;}},
        showYAxis:    {get: function(){return showYAxis;}, set: function(_){showYAxis=_;}},
        defaultState:    {get: function(){return defaultState;}, set: function(_){defaultState=_;}},
        brushExtent:    {get: function(){return brushExtent;}, set: function(_){brushExtent=_;}},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
        reduceXTicks:    {get: function(){return reduceXTicks;}, set: function(_){reduceXTicks=_;}},
        rotateLabels:    {get: function(){return rotateLabels;}, set: function(_){rotateLabels=_;}},
        staggerLabels:    {get: function(){return staggerLabels;}, set: function(_){staggerLabels=_;}},
        focusEnable:    {get: function(){return focusEnable;}, set: function(_){focusEnable=_;}},
        focusHeight:    {get: function(){return focusHeight;}, set: function(_){focusHeight=_;}},
        focusShowAxisX:    {get: function(){return focusShowAxisX;}, set: function(_){focusShowAxisX=_;}},
        focusShowAxisY:    {get: function(){return focusShowAxisY;}, set: function(_){focusShowAxisY=_;}},
        legendLeftAxisHint:    {get: function(){return legendLeftAxisHint;}, set: function(_){legendLeftAxisHint=_;}},
        legendRightAxisHint:    {get: function(){return legendRightAxisHint;}, set: function(_){legendRightAxisHint=_;}},

        // deprecated options
        tooltips:    {get: function(){return tooltip.enabled();}, set: function(_){
            // deprecated after 1.7.1
            nv.deprecated('tooltips', 'use chart.tooltip.enabled() instead');
            tooltip.enabled(!!_);
        }},
        tooltipContent:    {get: function(){return tooltip.contentGenerator();}, set: function(_){
            // deprecated after 1.7.1
            nv.deprecated('tooltipContent', 'use chart.tooltip.contentGenerator() instead');
            tooltip.contentGenerator(_);
        }},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        focusMargin: {get: function(){return margin2;}, set: function(_){
            margin2.top    = _.top    !== undefined ? _.top    : margin2.top;
            margin2.right  = _.right  !== undefined ? _.right  : margin2.right;
            margin2.bottom = _.bottom !== undefined ? _.bottom : margin2.bottom;
            margin2.left   = _.left   !== undefined ? _.left   : margin2.left;
        }},
        duration: {get: function(){return transitionDuration;}, set: function(_){
            transitionDuration = _;
            bars.duration(transitionDuration);
            bars2.duration(transitionDuration);
            lines.duration(transitionDuration);
            lines2.duration(transitionDuration);
            xAxis.duration(transitionDuration);
            x2Axis.duration(transitionDuration);
            y1Axis.duration(transitionDuration);
            y2Axis.duration(transitionDuration);
            y3Axis.duration(transitionDuration);
            y4Axis.duration(transitionDuration);
            renderWatch.reset(transitionDuration);
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
            legend.color(color);
        }},
        x: {get: function(){return getX;}, set: function(_){
            getX = _;
            lines.x(_);
            lines2.x(_);
            bars.x(_);
            bars2.x(_);
        }},
        y: {get: function(){return getY;}, set: function(_){
            getY = _;
            lines.y(_);
            lines2.y(_);
            bars.y(_);
            bars2.y(_);
        }},
        barColor:  {get: function(){return bars.barColor;}, set: function(_){
            bars.barColor(_);
            legend.color(function(d,i) {return d3.rgb('#ccc').darker(i * 1.5).toString();})
        }}
    });

    nv.utils.inheritOptions(chart, lines);
    nv.utils.initOptions(chart);

    return chart;
};
