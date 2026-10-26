(ns util.text (:require [clojure.string :as str]))
(defn shout [s] (str (str/upper-case s) "!"))
