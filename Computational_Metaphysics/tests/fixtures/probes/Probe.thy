theory Probe
  imports "HOML_Base.HOML_Base"
begin
consts p :: \<sigma>
consts G :: "e \<Rightarrow> \<sigma>"

lemma k_bad: "\<lfloor>\<^bold>\<diamond>p \<^bold>\<rightarrow> \<^bold>\<box>p\<rfloor>"
  nitpick [user_axioms, show_all, card = 1-4]
  oops

lemma k_pred: "\<lfloor>(\<^bold>\<exists>x. G x) \<^bold>\<rightarrow> \<^bold>\<box>(\<^bold>\<exists>x. G x)\<rfloor>"
  nitpick [user_axioms, show_all, card = 1-4]
  oops

axiomatization where
  S5_refl: "\<forall>x. x r x" and
  S5_trans: "\<forall>x y z. x r y \<and> y r z \<longrightarrow> x r z" and
  S5_sym: "\<forall>x y. x r y \<longrightarrow> y r x"

lemma s5_5: "\<lfloor>\<^bold>\<diamond>p \<^bold>\<rightarrow> \<^bold>\<box>\<^bold>\<diamond>p\<rfloor>"
  sledgehammer [timeout = 30]
  oops

lemma True
  nitpick [satisfy, user_axioms, show_all, card = 1-4]
  oops
end
