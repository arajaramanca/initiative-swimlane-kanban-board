/*
 * Need to override so that the picker can use the underlying story model
 * (instead of using the model factory which won't know what an extended model is)
 */Ext.override(Rally.ui.gridboard.plugin.GridBoardFieldPicker,{
    _getModels: function() {
        console.log('_getModels', this.modelNames );
        if ( Ext.isEmpty( this.modelNames ) ) {
            return _.reduce(this.cmp.getModels(), function(accum, model) {
                if (model.typePath === 'artifact') {
                    accum = accum.concat(model.getArtifactComponentModels());
                } else {
                    accum.push(model);
                }
                return accum;
            }, []);
        } else {
            return [{ typePath: 'HierarchicalRequirement' }];
        }
    }
});