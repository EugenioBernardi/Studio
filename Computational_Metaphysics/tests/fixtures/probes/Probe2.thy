theory Probe2
  imports "HOML_Base.HOML_Base"
begin
consts p :: \<sigma>

lemma k_bad: "\<lfloor>\<^bold>\<diamond>p \<^bold>\<rightarrow> \<^bold>\<box>p\<rfloor>"
  nitpick [user_axioms, show_all, card = 1-4, batch_size = 1]
  oops

lemma k_ok: "\<lfloor>\<^bold>\<box>(p \<^bold>\<rightarrow> p)\<rfloor>"
  nitpick [user_axioms, show_all, card = 1-4, batch_size = 1]
  oops

lemma nat_spur: "\<exists>n::nat. \<forall>m. m \<le> n"
  nitpick [show_all]
  oops

axiomatization where
  bad1: "\<lfloor>p\<rfloor>" and
  bad2: "\<lfloor>\<^bold>\<not>p\<rfloor>"

lemma True
  nitpick [satisfy, user_axioms, show_all, card = 1-4, batch_size = 1]
  oops

lemma False
  sledgehammer [timeout = 20]
  oops
end
