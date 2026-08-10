import{s as e}from"./DlroovWE.js";import{al as a,B as n,C as s,a9 as i,az as p}from"./DE8S2mki.js";import{s as r}from"./jc0MLXVe.js";import"./DmQZNIqN.js";var u=`
    .p-radiobutton-group {
        display: inline-flex;
    }
`,d={root:"p-radiobutton-group p-component"},m=a.extend({name:"radiobuttongroup",style:u,classes:d}),l={name:"BaseRadioButtonGroup",extends:e,style:m,provide:function(){return{$pcRadioButtonGroup:this,$parentInstance:this}}},c={name:"RadioButtonGroup",extends:l,inheritAttrs:!1,data:function(){return{groupName:this.name}},watch:{name:function(o){this.groupName=o||r("radiobutton-group-")}},mounted:function(){this.groupName=this.groupName||r("radiobutton-group-")}};function f(t,o,g,h,B,$){return n(),s("div",p({class:t.cx("root")},t.ptmi("root")),[i(t.$slots,"default")],16)}c.render=f;export{c as default};
