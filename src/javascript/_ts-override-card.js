Ext.override(Rally.ui.cardboard.Card,{
    needByDateField: null,
    colorByNeedByDate: false,
    
    isBeyondNeedByDate: function() {
        var record = this.getRecord();
        var today = new Date();
                
        return record.isFieldVisible(this.needByDateField) && record.get(this.needByDateField) && today > record.get(this.needByDateField);
    },
    
    _onBeforeRender: function () {
        this._displayState();
        this._addNeedByDateDecorator();
        this.html = this._buildHtml();
    },
    
    _addNeedByDateDecorator: function() {
        
        if (this.colorByNeedByDate && this.isBeyondNeedByDate()) {
            this.addCls('beyondDate');
        }
    }
    
});